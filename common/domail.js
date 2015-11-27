var oracledb = require( 'oracledb' ),
  async = require( 'async' ),
  exec = require( 'child_process' ).exec,
  log = require( './logger.js' ),
  mounts = require( './mounts.js' ),
  audit = require( './audit.js' ),
  auditlog = require( './auditlog.js' ),
  mail = require( './mail.js' ),
  lockpdf = require( './lockpdf.js' ),
  releaselockpdf = require( './releaselockpdf.js' ),
  updatepdfstatus = require( './updatepdfstatus.js' ),
  dirRemoteJdePdf = process.env.DIR_JDEPDF,
  dirLocalJdePdf = process.env.DIR_SHAREDDATA,
  jdeEnv = process.env.JDE_ENV,
  jdeEnvDb = process.env.JDE_ENV_DB;


module.exports.doMail = function( parg, cbDone ) {

  // Check Remote Mounts in place for access to JDE PDF files in JDE Output Queue
  mounts.checkRemoteMounts( function( err, result ) {

    if ( err ) { 

      mounts.establishRemoteMounts( function( err, result ) {

        if ( err ) {

          log.w( parg.newPdf + ' : Problem with Remote Mounts - Failed to reconnect - Try again shortly' );
          return cbDone( err );

        } else {

          log.w( parg.newPdf + ' : Problem with Remote Mounts - Reconnected Ok - continue with Mail processing shortly' );
          return cbDone( null );       

        }
      });

    } else {

      parg.cmd = 'BEGIN MAIL Processing';
      parg.cmdResult = ' ';

      // Check shows Mounts in place so handle Mail Processing
      async.series([
        function( cb ) { auditLog( parg, cb ) },
        function( cb ) { lockPdf( parg, cb ) },
        function( cb ) { auditLog( parg, cb ) },
        function( cb ) { checkConfiguration( parg, cb ) },
        function( cb ) { auditLog( parg, cb ) },
        function( cb ) { copyPdf( parg, cb ) },
        function( cb ) { auditLog( parg, cb ) },
        function( cb ) { mailReport( parg, cb )}, 
        function( cb ) { auditLog( parg, cb ) },
        function( cb ) { removePdfCopy( parg, cb )}, 
        function( cb ) { auditLogOptional( parg, cb ) },
        function( cb ) { updatePdfEntryStatus( parg, cb ) },
        function( cb ) { auditLog( parg, cb ) }

      ], function( err, result ) {

        if ( err ) {

          // When error log last command and result 
          log.w( parg.cmd );
          log.w( parg.cmdResult );

          log.e( parg.newPdf + ' : Error encountered trying to process Mail : ' + err );
          releaseLockReturn( parg, cbDone );

        } else {

          log.i( parg.newPdf + ' : Mail Processing Completed ' );
          releaseLockReturn( parg, cbDone );

        }    
      });
    }
  });

}


function auditLogOptional( parg, cb ) { 

  if ( parg.applyLogo == 'Y' ) { 

    parg.comments = parg.cmd + ' ' + parg.cmdResult; 

    auditlog.auditLog( parg, function( err, result ) {

      if ( err ) {

        log.e( parg.newPdf + ' : Failed to write Audit Log Entry to JDE : DB error? ' + err );  
        parg.cmdResult += 'FAILED : ' + result;
        return cb( err );

      } else {

        log.d( parg.newPdf + ' : Audit Log Entry : ' + result );  
        parg.cmdResult += 'OK : ' + result;
        return cb( null );

      }
    });
  } else {

    return cb( null );

  }

}


function auditLog( parg, cb ) { 

  parg.comments = parg.cmd + ' ' + parg.cmdResult; 

  auditlog.auditLog( parg, function( err, result ) {

    if ( err ) {

      log.e( parg.newPdf + ' : Failed to write Audit Log Entry to JDE : DB error? ' + err );  
      parg.cmdResult += 'FAILED : ' + result;
      return cb( err );

    } else {

      log.d( parg.newPdf + ' : Audit Log Entry : ' + result );  
      parg.cmdResult += 'OK : ' + result;
      return cb( null );

    }
  });

}


// Lock PDF for duration of any Mail processing - need exclusive access
//
function lockPdf( parg, cb ) {

  log.v( parg.newPdf + ' : Lock PDF : Exclusivity required for Mail processing ' );
  parg.cmd = 'LOCK PDF | ';
  parg.cmdResult = ' ';

  lockpdf.lockPdf( parg, function( err, result ) {

    if ( err ) {

      log.w( parg.newPdf + ' : Unable to place Lock on this PDF : Already in use? ' );  
      parg.cmdResult += 'FAILED : ' + result;
      return cb( err );

    } else {

      log.v( parg.newPdf + ' : Lock Placed : ' + result );  
      parg.cmdResult += 'OK : ' + result;
      return cb( null );

    }
  });

}


function checkConfiguration( parg, cb ) {

  var pdfInput,
    pdfOutput,
    cmd,
    option;

  log.v( parg.newPdf + ' : Check Configuration : Is PDF set up for Mail processing? ' );
  parg.cmd = 'CHECK CONFIG | ';
  parg.cmdResult = ' ';
  parg.mailEnabled = 'N';

  mail.prepMail( parg, function( err, result ) {

    if ( err ) {

      log.e( parg.newPdf + ' : Error trying to get PDFMAIL config/setup : ' + err );    
      parg.mailSent = 'N';
      parg.mailReason = 'Failed to get any mail configuration';
      parg.cmdResult += 'FAILED : ' + result;
      return cb( err );

    } else {

      log.v( parg.cmd + ' : OK ' + result );
      log.i( parg.newPdf + ' : Mail Configuration found ' );
      for ( var key in result ) {
        if ( result.hasOwnProperty( key )) {

          log.i( parg.pdf + ' ' + key + ' : ' + result[ key ]);

          option = result[ key ]

          if ( option[ 0 ] === 'EMAIL' ) {
            parg.mailEnabled = option[ 1 ]
          }        
          if ( option[ 0 ] === 'EMAIL_CSV' ) {
            parg.mailCsv = option[ 1 ];
          }        
        }
      }
     
      if ( parg.mailEnabled !== 'Y' ) {

        // Email configuration may exist for report but could be disabled EMAIL=N
        // If disabled dont send email but continue without error so status is updated to complete 
        parg.mailSent = 'N'
        parg.mailReason = 'Mail Configuration options exists but Email report is disabled'
        return cb( null );

      } else {

        // Save mail options and continue to next step
        parg.mailOptions = result;
        return cb( null );

      }
    }
  });  

}


function copyPdf( parg, cb ) {

  var cmd;

  // Copy PDF from JDE Output Queue to working folder (on Aix) - append _ORIGINAL to PDF name
  parg.cmd = 'COPY PDF | ';
  parg.cmdResult = ' ';

  if ( parg.mailEnabled != 'Y' ) { 

    log.v( parg.newPdf + parg.cmd + ' : SKIP : Report Mailing Disabled ' );
    return cb( null );

  } else {

    // Copy the PDF or the CSV file
    if ( parg.mailCsv !== 'Y' ) {

      cmd = "cp /home/pdfdata/" + parg.newPdf + " /home/shareddata/wrkdir/" + parg.newPdf.trim() + '.pdf';
      log.v( parg.newPdf + parg.cmd + ' - Copy report to be mailed and give it a .pdf extension' );

    } else {

      cmd = "cp /home/pdfdata/" + parg.newPdf.trim() + '.csv' + " /home/shareddata/wrkdir/" + parg.newPdf.trim() + '.csv';
      log.v( parg.newPdf + parg.cmd + ' - Copy report to be mailed to work directory and give it .csv extension' );

    }

    log.d( parg.newPdf + parg.cmd + cmd );

    exec( cmd, function( err, stdout, stderr ) {

      log.d( parg.newPdf + ' : ' + err );  
      log.d( parg.newPdf + ' : ' + stdout );  
      log.d( parg.newPdf + ' : ' + stderr );  

      if ( err ) {

        parg.cmdResult += 'FAILED : Unable to Copy Report : ' + stdout + stderr;
        log.e( parg.newPdf + parg.cmd + parg.cmdResult );
        return cb( err );

      } else {
 
        parg.cmdResult += 'OK : Copy Report : ' + stdout + ' ' + stderr;
        log.v( parg.newPdf + parg.cmd + parg.cmdResult );
        return cb( null );

      }
    });
  }

}


// Email Report if mailing is not disabled 
function mailReport( parg, cb ) {

  parg.cmd = 'EMAIL REPORT | ';
  parg.cmdResult = ' ';

  log.v( JSON.stringify( parg ) );

  if ( parg.mailEnabled !== 'Y' ) {

    log.v( parg.newPdf + parg.cmd + ' : SKIP : Report Mailing disabled' );
    return cb( null )

  } else {

    mail.doMail( parg.newPdf, parg.mailOptions, function( err, result ) {

      log.d( parg.newPdf + ' : ' + err );  
      log.d( parg.newPdf + ' : ' + result );  

      if ( err ) {

        parg.cmdResult += 'FAILED : Unable to Email Report : ' + err + result;
        log.e( parg.newPdf + parg.cmd + parg.cmdResult );
        return cb( err )

      } else {

        parg.cmdResult += 'OK : ' + result;
        log.v( parg.newPdf + parg.cmd + parg.cmdResult );
        return cb( null )

      }
    }); 
  }
}




// After report emailed delete temporary .pdf file in work firectory
function removePdfCopy( parg, cb  ) {

  var cmd;

  parg.cmd = 'REMOVE PDF COPY | ';
  parg.cmdResult = ' ';

  if ( parg.mailEnabled !== 'Y' ) {

    log.v( parg.newPdf + parg.cmd + ' SKIP : Report Mailing disabled' );
    return cb( null )

  } else {

    if ( parg.mailCsv !== 'Y' ) {

      cmd = "rm /home/shareddata/wrkdir/" + parg.newPdf.trim() + ".pdf";

    } else {

      cmd = "rm /home/shareddata/wrkdir/" + parg.newPdf.trim() + ".csv";

    }
    log.d( cmd );

    exec( cmd, function( err, stdout, stderr ) {

      log.d( parg.newPdf + ' : ' + err );  
      log.d( parg.newPdf + ' : ' + stdout );  
      log.d( parg.newPdf + ' : ' + stderr );  

      if ( err ) {

        parg.cmdResult += 'FAILED : Unable to Remove Report Copy ' + stdout + stderr;
        log.e( parg.newPdf + parg.cmd + parg.cmdResult );
        return cb( err )

      } else {

        parg.cmdResult += 'OK : Removed Report Copy : ' + stdout + stderr;
        log.v( parg.newPdf + parg.cmd + parg.cmdResult );
        return cb( null );

      }
    });
  }
}


// Mail processing completed so shuffle PDF Entry to next Status
//
function updatePdfEntryStatus( parg, cb ) {

  parg.cmd = 'UPDATE STATUS | ';
  parg.cmdResult = ' ';

  updatepdfstatus.updatePdfStatus( parg, function( err, result ) {

    log.d( parg.newPdf + ' : ' + err );  
    log.d( parg.newPdf + ' : ' + result );  

    if ( err ) {

      parg.cmdResult += 'FAILED : Unable to Move Status : ' + err + result;
      log.e( parg.newPdf + parg.cmd + parg.cmdResult );
      return cb( err );

    } else {

      parg.cmdResult += 'OK : Status Updated : ' + result;
      log.v( parg.newPdf + parg.cmd + parg.cmdResult );
      return cb( null );

    }
  });

}


// Mail processing complete without error - release lock
// Mail processing errored then release lock anyway - allows attempt to recover on subsequent runs
//
function releaseLockReturn( parg, cbDone ) {

  parg.cmd = 'RELEASE LOCK | ';
  parg.cmdResult = ' ';

  releaselockpdf.releaseLockPdf( parg, function( err, result ) {

    log.d( parg.newPdf + ' : ' + err );  
    log.d( parg.newPdf + ' : ' + result );  

    if ( err ) {

      parg.cmdResult += 'FAILED : Unable to Release Lock : ' + err + result;
      log.e( parg.newPdf + parg.cmd + parg.cmdResult );
      return cb( err );

    } else {

      parg.cmdResult += 'OK : Lock Released : ' + result;
      log.v( parg.newPdf + parg.cmd + parg.cmdResult );  
      return cbDone( null );

    }
  });

}
