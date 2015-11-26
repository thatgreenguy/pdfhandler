// Module		: domail.js
// Description		: Handler that sends JDE PDF files as report attachments.
// Author		: Paul Green
// Dated		: 2015-10-19
//
// Called when a Queued PDF entry is waiting at Mail Status '200' 
// Gain exclusive use of the PDF via lock, fetch mail configuration for this particular JDE report/version
// copy original PDF to work directory and give it a proper .pdf extension so handled correctly by 
// mail clients, rename to .pdf, apply Dlink Logo to each page
// replace original JDE PDF in PrintQueue with Logo enhanced copy, move the Queued PDF entry to next status
// then release lock. 
// Audit log entries are written for each step to JDE Audit log table (1) to provide feedback/visibility  of this 
// application processing to the JDE team and (2) to allow use of audit log for recovery processing if required


var oracledb = require( 'oracledb' ),
  async = require( 'async' ),
  exec = require( 'child_process' ).exec,
  odb = require( './odb.js' ),
  lock = require( './lock.js' ),
  log = require( './logger.js' ),
  audit = require( './audit.js' ),
  mail = require( './mail.js' ),
  dirRemoteJdePdf = process.env.DIR_JDEPDF,
  dirLocalJdePdf = process.env.DIR_SHAREDDATA,
  jdeEnv = process.env.JDE_ENV,
  jdeEnvDb = process.env.JDE_ENV_DB;


// Functions - 
//
// module.exports.doMail = function( dbp, dbc, hostname, row, jdedate, jdetime, statusTo, cbWhenDone )
// function invalidConnection( err, pargs )
// function validConnection( cn, p )
// function placeLock( p, cb  )
// function getMailConfig( p, cb  )
// function copyPdf( p, cb  )
// function auditLogCopyPdf( p, cb  )
// function mailReport( p, cb )
// function auditLogMailReport( p, cb  ) 
// function removePdfCopy( p, cb  )
// function auditLogRemovePdfCopy( p, cb  )
// function updateProcessQueueStatus( p, cb  )
// function auditLogQueuedPdfStatusChanged( p, cb  )
// function finalStep( p  )


module.exports.doMail = function( pargs, cbDone ) {

  log.d( 'Mail processing here...');

  return cbDone( null );

}


// Called when Queued PDF file is at status '200' waiting to be E-mailed
module.exports.doMail = function( dbp, dbc, hostname, row, jdedate, jdetime, statusFrom, statusTo, cbWhenDone ) {
  var pargs;

  pargs = { 'dbp': dbp, 
          'dbc': dbc, 
          'hostname': hostname,
          'row': row,
          'pdf': row[ 0 ],
          'jdedate': jdedate,
          'jdetime': jdetime,
          'statusFrom': statusFrom,
          'statusTo': statusTo,
          'cbWhenDone': cbWhenDone };

  // Grab a connection from the pool
  odb.getConnection( dbp, function( err, cn ) {

    if ( err ) {

      return invalidConnection( err, pargs );

    } else {

      return validConnection( cn, pargs )

    }
  });
}


// Could not get a Connection - return and retry after polling interval
function invalidConnection( err, pargs ) {

  log.i( 'Unable to get a connection at the moment - give up and retry on next poll ' );
  log.d( JSON.stringify( pargs ) );
  
  return ( pargs.cbWhenDone( null ) );

}


// Connection established continue with Mail processing
function validConnection( cn, p ) {

  p.mycn = cn;

  async.series([
    function( next ) { placeLock( p, next )}, 
    function( next ) { getMailConfig( p, next )},
    function( next ) { copyPdf( p, next )},
    function( next ) { auditLogCopyPdf( p, next )},
    function( next ) { mailReport( p, next )}, 
    function( next ) { auditLogMailReport( p, next )}, 
    function( next ) { removePdfCopy( p, next )}, 
    function( next ) { auditLogRemovePdfCopy( p, next )},
    function( next ) { updateProcessQueueStatus( p, next )},
    function( next ) { auditLogQueuedPdfStatusChanged( p, next )}

  ], function( err, resp ) {

    log.d( 'Release Lock, Connection then continue back to caller : ' );

    if ( err ) {

      log.d( 'Async series experienced error' + err );
      finalStep( p ) 

    } else {

      log.d( 'Async series Done' );
      finalStep( p )
    }
  }); 
}


// Get exclusive Lock for this PDF
function placeLock( p, cb  ) {

  log.i( p.pdf + ' Step 1 - Place Lock on this PDF file ' );

  lock.placeLock( p.mycn, p.row, p.hostname, function( err, result ) {
    if ( err ) {
      return cb( err )
    } else {
      return cb( null )
    }
  }); 
}


// Fetch the Email configuration for this Report and Version
function getMailConfig( p, cb  ) {

  var pdfInput,
    pdfOutput,
    cmd,
    option;

  // Mail flag initially set to 'No' set from actual mail config options below
  p.mailenabled = 'N';

  log.i( p.pdf + ' Step 2 - fetch Mail Configuration Options for this Report/Version ' );

  // First fetch Mail Options for this Report and Version
  mail.prepMail( p.mycn, p.pdf, function( err, result ) {

    if ( err ) {

      log.v( ' prepMail: Error ' + err );
      log.w( p.pdf + ' No Mail Configuration found - Nothing Sent ' );

      // If error returned when trying to get email configuration options for this report then 
      // return with error and retry next run
      p.mailSent = 'N'
      p.mailReason = 'Failed to get mail config'
      return cb( err )

    } else {

      log.v( ' prepMail: OK ' + result );
      log.i( p.pdf + ' Mail Configuration found - Checking ' );
      for ( var key in result ) {
        if ( result.hasOwnProperty( key )) {

          log.i( p.pdf + ' ' + key + ' : ' + result[ key ]);

          option = result[ key ]

          if ( option[ 0 ] === 'EMAIL' ) {
            p.mailenabled = option[ 1 ]
          }        
          if ( option[ 0 ] === 'EMAIL_CSV' ) {
            p.mailcsv = option[ 1 ]
          }        
        }
      }
     
      if ( p.mailenabled !== 'Y' ) {

        // Email configuration may exist for report but could be disabled EMAIL=N
        // If disabled dont send email but continue without error so status is updated to complete 
        p.mailSent = 'N'
        p.mailReason = 'Mail Configuration options exists but Email report is disabled'
        return cb( null )

      } else {

        // Save mail options and continue to next step
        p.mailoptions = result
        return cb( null )

      }
    }
  });

}

// Make a copy of the Report and give it a .pdf extension so it is handled correctly by mail clients
function copyPdf( p, cb  ) {

  var cmd;

  log.v( JSON.stringify(p) );

  if ( p.mailenabled !== 'Y' ) {

    log.i( p.pdf + ' Step 3 - Skip as Report Mailing has been disabled' ); 
    return cb( null );

  } else {  

    log.i( p.pdf + ' Step 3 - Create .pdf version of report for mailing' );

    // Copy the PDF or the CSV file
    if ( p.mailcsv !== 'Y' ) {
      cmd = "cp /home/pdfdata/" + p.pdf + " /home/shareddata/wrkdir/" + p.pdf.trim() + '.pdf';
      log.i( p.pdf + " - Copy report to be mailed to work directory and give it a .pdf extension" );
    } else {
     cmd = "cp /home/pdfdata/" + p.pdf.trim() + '.csv' + " /home/shareddata/wrkdir/" + p.pdf.trim() + '.csv';
     log.i( p.pdf.trim() + ".csv" + " - Copy report to be mailed to work directory and give it .csv extension" );
    }

    log.d( cmd );

    exec( cmd, function( err, stdout, stderr ) {
      if ( err ) {
        log.d( ' ERROR: ' + err );
        return cb( err, stdout + stderr + " - Failed" );
      } else {
        return cb( null, stdout + ' ' + stderr + " - Done" );
      }
    });
  }
}


// Create Audit record signalling PDF Copy made for Mail sending has been done
function auditLogCopyPdf( p, cb  ) {

  var comments;

  log.i( p.pdf + ' Step 3a - Write Audit Entry ' );

  if ( p.mailenabled !== 'Y' ) {
    comments = 'MAIL_STEP1_CopyPdf_Config indicates Email currently Disabled for Report / Version'; 
  } else {
    if ( p.mailcsv !== 'Y' ) {
      comments = 'MAIL_STEP1_CopyPdf_.pdf attachment copy made in working directory'; 
    } else {
      comments = 'MAIL_STEP1_CopyPdf_.csv attachment copy made in working directory'; 
    }
  }

  audit.createAuditEntry( p.dbc, p.pdf, p.row[ 2 ], p.hostname, p.statusFrom, comments, function( err, result ) {
    if ( err ) {
      return cb( err )
    } else {
      return cb( null )
    }
  }); 
  
}


// Email Report if mailing is not disabled 
function mailReport( p, cb ) {

  log.v( JSON.stringify( p ) );

  if ( p.mailenabled !== 'Y' ) {

    log.i( p.pdf + ' Step 4 - Skip as Report Mailing has been disabled' );
    return cb( null )

  } else {

    log.i( p.pdf + ' Step 4 - Emailing Report' );

    mail.doMail( p.pdf, p.mailoptions, function( err, result ) {

      if ( err ) {

        log.i( 'doMail: Error ' + err );
        return cb( err )

      } else {

        log.i( 'doMail: OK ' + result );
        return cb( null )

      }
    }); 
  }
}


// Create Audit record signalling PDF Copy made for Mail sending has been removed / cleaned up
function auditLogMailReport( p, cb  ) {

  var comments;

  log.i( p.pdf + ' Step 4a - Write Audit Entry ' );

  if ( p.mailenabled !== 'Y' ) {
    comments = 'MAIL_STEP2_mailReport_SKIP_Config indicates Email currently Disabled for Report / Version'; 
  } else {
    comments = 'MAIL_STEP2_mailReport_SENT_Mail Server indicates Mail Sent'; 
  }

  audit.createAuditEntry( p.dbc, p.pdf, p.row[ 2 ], p.hostname, p.statusFrom, comments, function( err, result ) {
    if ( err ) {
      return cb( err )
    } else {
      return cb( null )
    }
  }); 
  
}


// After report emailed delete temporary .pdf file in work firectory
function removePdfCopy( p, cb  ) {

  var cmd;

  if ( p.mailenabled !== 'Y' ) {

    log.i( p.pdf + ' Step 5 - Skip as Report Mailing has been disabled' );
    return cb( null )

  } else {

    log.i( p.pdf + ' Step 5 - Remove temporary .pdf or .csv file once mail sent' );

    if ( p.mailcsv !== 'Y' ) {
      cmd = "rm /home/shareddata/wrkdir/" + p.pdf.trim() + ".pdf";
    } else {
      cmd = "rm /home/shareddata/wrkdir/" + p.pdf.trim() + ".csv";
    }
    log.d( cmd );

    exec( cmd, function( err, stdout, stderr ) {
      if ( err ) {

        log.d( ' ERROR: ' + err );
        return cb( err, stdout + stderr + " - Failed" );

      } else {

        return cb( null, stdout + ' ' + stderr + " - Done" );

      }
    });
  }
}


// Create Audit record signalling PDF Copy made for Mail sending has been removed / cleaned up
function auditLogRemovePdfCopy( p, cb  ) {

  var comments;

  log.i( p.pdf + ' Step 5a - Write Audit Entry ' );

  if ( p.mailenabled !== 'Y' ) {
    comments = 'MAIL_STEP3_RemovePdfCopy_SKIP_Config indicates Email currently Disabled for Report / Version'; 
  } else {
    if ( p.mailcsv !== 'Y' ) {
      comments = 'MAIL_STEP3_RemovePdfCopy_.pdf Attachment Copy removed from work directory'; 
    } else {
      comments = 'MAIL_STEP3_RemovePdfCopy_.csv Attachment Copy removed from work directory'; 
    }
  }

  audit.createAuditEntry( p.dbc, p.pdf, p.row[ 2 ], p.hostname, p.statusFrom, comments, function( err, result ) {
    if ( err ) {
      return cb( err )
    } else {
      return cb( null )
    }
  }); 
  
}


// Update Pdf entry in JDE Process Queue from current status to next Status
// E.g. When Mail processing done change Pdf Queue entry status from say 200 to 999 (Complete)
function updateProcessQueueStatus( p, cb  ) {

  log.i( p.pdf + ' Step 6 - Update PDF process Queue entry to next status as Mailing done ' );
  audit.updatePdfQueueStatus( p.dbc, p.pdf, p.row[ 2 ], p.hostname, p.statusTo, function( err, result ) {
    if ( err ) {
      return cb( err )
    } else {
      return cb( null )
    }
  }); 
  
}


// Create Audit record signalling PDF has been processed for Logo
function auditLogQueuedPdfStatusChanged( p, cb  ) {

  var comments;

  log.i( p.pdf + ' Step 6a - Write Audit Entry ' );

  comments = 'MAIL_STEP4_QueuedPdfStatusChanged_MAIL COMPLETE - Queued Pdf entry now at status ' + p.statusTo; 

  audit.createAuditEntry( p.dbc, p.pdf, p.row[ 2 ], p.hostname, p.statusFrom, comments, function( err, result ) {
    if ( err ) {
      return cb( err )
    } else {
      return cb( null )
    }
  }); 
  
}


// Release Lock entry for this PDF - Called when processing complete or if error
function finalStep( p  ) {

  log.i( p.pdf + ' finalStep - Release Lock ' );

  lock.removeContainerLock( p.mycn, p.row, p.hostname, function( err, result ) {

    if ( err ) {
      releaseAndReturn( p );
    } else {
      releaseAndReturn( p );
    }


    // Once in final step error or not just release Lock, release Connection and return
    function releaseAndReturn( p ) {

     if ( p.mycn ) { 

       p.mycn.release( function( err ) {
         if ( err ) {
           log.e( 'Unable to release DB connection ' + err );
           p.cbWhenDone( err ); 
         } else {
           log.d( 'DB Resource connection released - Finished so return' );
           log.v( p.pdf + ' finalStep - Mail Processing Complete ' );
           p.cbWhenDone( null ); 
         }
       });
     } else {
       log.d( 'No Connection to release - Finished so return' );
       log.v( p.pdf + ' finalStep - Mail Processing Complete ' );
       p.cbWhenDone( null ); 
      }
    }
  }); 
}
