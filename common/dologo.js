// Module		: dologo.js
// Description		: Handler that applies Logo image to each page of a given JDE PDF file.
// Author		: Paul Green
// Dated		: 2015-10-19
//
// Called when a Queued PDF entry is waiting for Logo to be applied
// Gain exclusive use of the PDF via lock, copy original PDF to work directory, apply Dlink Logo to each page
// replace original JDE PDF in PrintQueue with Logo enhanced copy, move the Queued PDF entry to next status
// then release lock. 
// Audit log entries are written for each step to JDE Audit log table (1) to provide feedback/visibility  of this 
// application processing to the JDE team and (2) to allow use of audit log for recovery processing if required


var oracledb = require( 'oracledb' ),
  async = require( 'async' ),
  exec = require( 'child_process' ).exec,
  log = require( './logger.js' ),
  mounts = require( './mounts.js' ),
  audit = require( './audit.js' ),
  getlogoconfig = require( './getlogoconfig.js' ),
  lockpdf = require( './lockpdf.js' ),
  releaselockpdf = require( './releaselockpdf.js' ),
  updatepdfstatus = require( './updatepdfstatus.js' ),
  logoinfo = require( './logoinfo.js' ),
  dirRemoteJdePdf = process.env.DIR_JDEPDF,
  dirLocalJdePdf = process.env.DIR_SHAREDDATA,
  jdeEnv = process.env.JDE_ENV,
  jdeEnvDb = process.env.JDE_ENV_DB;


// Functions -
//
// module.exports.doLogo = function( dbp, dbc, hostname, row, jdedate, jdetime, statusFrom, statusTo, cbWhenDone ) {
// function invalidConnection( err, pargs ) 
// function validConnection( cn, p ) 
// function placeLock( p, cb  ) 
// function confirmLogoReady( p, cb  ) 
// function copyPdf( p, cb  ) 
// function auditLogCopyPdf( p, cb  ) 
// function applyLogo( p, cb  ) 
// function auditLogLogoApply( p, cb  )
// function replaceJdePdf( p, cb  ) 
// function auditLogJdePdfReplaced( p, cb  )
// function updateProcessQueueStatus( p, cb  ) 
// function auditLogQueuedPdfStatusChanged( p, cb  )
// function finalStep( p  ) 
//


module.exports.doLogo = function( parg, cbDone ) {

  log.d( parg.newPdf + ' : Start Logo processing ......');

  // Check Remote Mounts in place for access to JDE PDF files in JDE Output Queue
  mounts.checkRemoteMounts( function( err, result ) {

    if ( err ) { 

      mounts.establishRemoteMounts( function( err, result ) {

        if ( err ) {

          log.w( parg.newPdf + ' : Problem with Remote Mounts - Failed to reconnect - Try again shortly' );
          return cbDone( err );

        } else {

          log.w( parg.newPdf + ' : Problem with Remote Mounts - Reconnected Ok - continue with Logo processing shortly' );
          return cbDone( null );       

        }
      });

    } else {

      // Check shows Mounts in place so handle Logo Processing
      async.series([
        function( cb ) { lockPdf( parg, cb ) },
        function( cb ) { checkConfiguration( parg, cb ) },
        function( cb ) { copyPdf( parg, cb ) },
        function( cb ) { applyLogo( parg, cb ) },
        function( cb ) { replacePdf( parg, cb ) },
        function( cb ) { updatePdfEntryStatus( parg, cb ) }

      ], function( err, result ) {

        if ( err ) {

          // When error log last command and result 
          log.w( parg.cmd );
          log.w( parg.cmdResult );

          log.e( parg.newPdf + ' : Error encountered trying to proces Logo : ' + err );
          releaseLockReturn( parg, cbDone );

        } else {

          releaseLockReturn( parg, cbDone );

        }    
      });
    }
  });

}


// Lock PDF for duration of any Logo processing - need exclusive access
//
function lockPdf( parg, cb ) {

  log.d( parg.newPdf + ' : Lock PDF : Exclusivity required for Logo processing ' );
  parg.cmd = 'lockPdf : ';
  parg.cmdResult = 'lockPdf : ';

  lockpdf.lockPdf( parg, function( err, result ) {

    if ( err ) {

      log.d( parg.newPdf + ' : Unable to place Lock on this PDF : Already in use? ' );  
      parg.cmdResult += 'FAILED : ' + result;
      return cb( err );

    } else {

      log.d( parg.newPdf + ' : Lock Placed : ' + result );  
      parg.cmdResult += 'OK : ' + result;
      return cb( null );

    }
  });

}


function checkConfiguration( parg, cb ) {

  log.d( parg.newPdf + ' : Check Configuration : Is PDF set up for Logo processing? ' );

  getlogoconfig.getLogoConfig( parg, function( err, result ) {

    if ( err ) {

      log.e( parg.newPdf + ' : Error trying to get PDFLOGO config/setup : ' + err );    
      return cb( err );

    } else {

      if ( parg.applyLogo == 'Y' ) {
        log.v( parg.newPdf + ' : PDFLOGO : Required ' );    
      } else {
        log.v( parg.newPdf + ' : PDFLOGO : Not Required just Advance Status  ' );    
      }
      return cb( null );

    }
  });  

}


function copyPdf( parg, cb ) {

  var cmd;

  // Copy PDF from JDE Output Queue to working folder (on Aix) - append _ORIGINAL to PDF name
  log.d( parg.newPdf + ' : Copy PDF : Copy original JDE PDF (from Output Queue) to working copy appended with "_ORIGINAL"' );
  parg.cmd = 'copyPdf : ';
  parg.cmdResult = 'copyPdf : ';

  if ( parg.applyLogo !== 'Y' ) { 

    return cb( null );

  } else {

    cmd = "cp /home/pdfdata/" + parg.newPdf + " /home/shareddata/wrkdir/" + parg.newPdf.trim() + "_ORIGINAL";
    parg.cmd += cmd;
    log.d( cmd );

    exec( cmd, function( err, stdout, stderr ) {
      if ( err ) {
        parg.cmdResult += 'FAILED : ' + err;
        log.d( parg.cmdResult );
        return cb( err, parg.cmdResult );

      } else {
        parg.cmdResult += 'OK : ' + stdout + ' ' + stderr;
        return cb( null, parg.cmdResult );

      }
    });
  }

}


function applyLogo( parg, cb ) {

  // Apply Logo image using copy PDF in working folder and creating new PDF with logos in working folder
  log.d( parg.newPdf + ' : Apply Logo and create new PDF file with same name as original but with Logo images applied' );
  parg.cmd = 'applyLogo : ';
  parg.cmdResult = 'applyLogo : ';



  return cb( null );

}


function replacePdf( parg, cb ) {

  // Apply Logo image using copy PDF in working folder and creating new PDF with logos in working folder
  log.d( parg.newPdf + ' : Replace original Pdf (in JDE PrintQueue) with new Logo Pdf in working directory' );
  parg.cmd = 'replacePdf : ';
  parg.cmdResult = 'replacePdf : ';


  return cb( null );

}


// Update PDF status in PDF Process Queue from 100 to 200
//
function updatePdfEntryStatus( parg, cb ) {

  // Logo processing completed so shuffle PDF Entry to next Status
  log.d( parg.newPdf + ' : Update PDF Entry Process Queue Status : Logo Processing Done ' );
  parg.cmd = 'updateStatus : ';
  parg.cmdResult = 'updateStatus : ';

  updatepdfstatus.updatePdfStatus( parg, function( err, result ) {

    if ( err ) {

      log.d( parg.newPdf + ' : Unable to update Process Queue (F559811) Status? ' );  
      parg.cmdResult += 'FAILED : ' + result;
      return cb( err );

    } else {

      log.d( parg.newPdf + ' : Status Updated : ' + result );  
      parg.cmdResult += 'OK : ' + result;
      return cb( null );

    }
  });

}


function releaseLockReturn( parg, cbDone ) {

  // Logo processing complete without error - release lock
  // logo processing errored then release lock anyway - allows attempt to recover on subsequent runs

  log.d( parg.newPdf + ' : Release Lock on PDF entry ' );
  parg.cmd = 'releaseLock : ';
  parg.cmdResult = 'releaseLock : ';

  releaselockpdf.releaseLockPdf( parg, function( err, result ) {

    if ( err ) {

      log.d( parg.newPdf + ' : Unable to release Lock on this PDF? ' );  
      parg.cmdResult += 'FAILED : ' + result;
      return cbDone( err );

    } else {

      log.d( parg.newPdf + ' : Lock Released : ' + result );  
      parg.cmdResult += 'OK : ' + result;
      return cbDone( null );

    }
  });

}





// OLD CODE FOR REFERENCE ONLY .......................
module.exports.OLDdoLogo = function( dbp, dbc, hostname, row, jdedate, jdetime, statusFrom, statusTo, cbWhenDone ) {

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


// Connection established continue with Logo processing
function validConnection( cn, p ) {

  p.mycn = cn;


  async.series([
    function( next ) { placeLock( p, next ) }, 
    function( next ) { confirmWaitingLogo( p, next )}, 
    function( next ) { fetchPdflogoSetup( p, next )}, 
    function( next ) { auditLogLogoSetup( p, next )}, 
    function( next ) { copyPdf( p, next )}, 
    function( next ) { auditLogCopyPdf( p, next )}, 
    function( next ) { applyLogo( p, next )}, 
    function( next ) { auditLogLogoApply( p, next )},
    function( next ) { replaceJdePdf( p, next )}, 
    function( next ) { auditLogJdePdfReplaced( p, next )},
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


// Check Audit to make sure it has not been recently processed by any other instance of this app
function confirmWaitingLogo( p, cb  ) {

  // step only required if we start running multiple instances.... see reference code at bottom
  // this feature not yet implemeneted!!
  log.i( p.pdf + ' Step 2 - Check Audit file to ensure PDF definitely not yet had Logo applied ' );
  
  return cb( null )

}


// Fetch PDFLOGO setup entries for the current PDF
function fetchPdflogoSetup( p, cb  ) {

  log.i( p.pdf + ' Step 2a - Fetch PDFLOGO setup/configuration entries ' );
  logoinfo.checkPdflogoSetup( p, function( err, res ) {

    if ( err ) {

      log.d( p.pdf + ' Step 2a - Error whilst retrieving PDFLOGO setup/config entries : ' + err );

      return cb( err )
 
    } else {

      log.d( p.pdf + ' Step 2a - PDFLOGO setup/config entry check okay : ' );

      if ( p.applyLogo === 'Y' ) {
        log.d( p.pdf + ' Step 2a - Apply Logo ' );     
      } else {
        log.d( p.pdf + ' Step 2a - Do Not Apply Logo ' );
      } 
 
      return cb( null )

   }
  });

}


// Write Audit Entry showing Whether Logo should be applied or not as per Setup/Config
function auditLogLogoSetup( p, cb  ) {

  var comments;

  log.i( p.pdf + ' Step 2b - Write Audit Entry ' );

  if ( p.applyLogo === 'Y' ) { 
    comments = 'LOGO_STEP2_ApplyLogo_YES'; 
  } else {
    comments = 'LOGO_STEP2_ApplyLogo_NO'; 
  } 

  audit.createAuditEntry( p.dbc, p.pdf, p.row[ 2 ], p.hostname, p.statusFrom, comments, function( err, result ) {
    if ( err ) {
      return cb( err )
    } else {
      return cb( null )
    }
  }); 
  
}


// Make a backup copy of the original JDE PDF file
function OLDcopyPdf( p, cb  ) {

  var cmd;

  if ( p.applyLogo !== 'Y' ) { 

    return cb( null );

  } else {

    log.i( p.pdf + ' Step 3 - Backup Original PDF ' );
  
    cmd = "cp /home/pdfdata/" + p.pdf + " /home/shareddata/wrkdir/" + p.pdf.trim() + "_ORIGINAL";

    log.d( "JDE PDF " + p.pdf + " - Make backup copy of original JDE PDF file in work directory" );
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


// Write Audit Entry showing CopyPdf Step completed
function auditLogCopyPdf( p, cb  ) {

  var comments;

  if ( p.applyLogo !== 'Y' ) { 

    return cb( null );

  } else {

    log.i( p.pdf + ' Step 3a - Write Audit Entry ' );

    comments = 'LOGO_STEP1_CopyPdf ' + p.extraErrorInfo; 

    audit.createAuditEntry( p.dbc, p.pdf, p.row[ 2 ], p.hostname, p.statusFrom, comments, function( err, result ) {
      if ( err ) {
        return cb( err )
      } else {
        return cb( null )
      }
    }); 
  }  
}


// Apply Logo to each page
function OLDapplyLogo( p, cb  ) {

  var pdfInput,
    pdfOutput,
    cmd;

  if ( p.applyLogo !== 'Y' ) { 

    return cb( null );

  } else {

    log.i( p.pdf + ' Step 4 - Apply Logo ' );

    pdfInput = "/home/shareddata/wrkdir/" + p.pdf.trim() + "_ORIGINAL";
    pdfOutput = '/home/shareddata/wrkdir/' + p.pdf;
    cmd = "node ./src/pdfaddlogo.js " + pdfInput + " " + pdfOutput;

    log.v( "JDE PDF " + p.pdf + " - Read original creating new PDF in work Directory with logos" );
    log.d( cmd );

    exec( cmd, function( err, stdout, stderr ) {
      if ( err !== null ) {
        log.d( cmd + ' ERROR: ' + err );
        log.w( 'Errors when applying Logo: Check but likely due to Logo already applied in prior run: ');
        return cb( err, stdout + stderr + " - Failed" );
      } else {
        return cb( null, stdout + ' ' + stderr + " - Done" );
      }
    });
  }  
}


// Create Audit record signalling PDF has been processed for Logo
function auditLogLogoApply( p, cb  ) {

  var comments;

  if ( p.applyLogo !== 'Y' ) { 

    return cb( null );

  } else {

    log.i( p.pdf + ' Step 4a - Write Audit Entry ' );

    comments = 'LOGO_STEP2_ApplyLogo_Dlink Logo added to working copy of Original JDE PDF'; 

    audit.createAuditEntry( p.dbc, p.pdf, p.row[ 2 ], p.hostname, p.statusFrom, comments, function( err, result ) {
      if ( err ) {
        return cb( err )
      } else {
        return cb( null )
      }
    }); 
  }  
}


// Replace JDE generated PDF file with modified Logo copy
function OLDreplaceJdePdf( p, cb  ) {

  var pdfInput,
    pdfOutput,
    cmd;

  if ( p.applyLogo !== 'Y' ) { 

    return cb( null );

  } else {

    log.i( p.pdf + ' Step 5 - Replace JDE PDF in PrintQueue with Logo version ' );
   
    pdfWithLogos = "/home/shareddata/wrkdir/" + p.pdf;
    jdePrintQueue = "/home/pdfdata/" + p.pdf,
    cmd = "mv " + pdfWithLogos + " " + jdePrintQueue;

    log.v( "JDE PDF " + p.pdf + " - Replace JDE output queue PDF with modified Logo version" );
    log.d( cmd );

    exec( cmd, function( err, stdout, stderr ) {
      if ( err !== null ) {
        log.debug( cmd + ' ERROR: ' + err );
        return cb( err, stdout + stderr + " - Failed" );
      } else {
        return cb( null, stdout + ' ' + stderr + " - Done" );
      }
    });
  } 
}


// Create Audit record signalling PDF has been processed for Logo
function auditLogJdePdfReplaced( p, cb  ) {

  var comments;

  if ( p.applyLogo !== 'Y' ) { 

    return cb( null );

  } else {

    log.i( p.pdf + ' Step 5a - Write Audit Entry ' );

    comments = 'LOGO_STEP3_JdePdfReplaced_JDE PrintQueue pdf replaced with Logo version from work directory'; 

    audit.createAuditEntry( p.dbc, p.pdf, p.row[ 2 ], p.hostname, p.statusFrom, comments, function( err, result ) {
      if ( err ) {
        return cb( err )
      } else {
        return cb( null )
      }
    }); 
  }  
}


// Update Pdf entry in JDE Process Queue from current statsu to next Status
// E.g. When Logo processing done change Pdf Queue entry status from say 100 to 200 (Email check next)
function updateProcessQueueStatus( p, cb  ) {

  log.i( p.pdf + ' Step 6 - Update PDF process Queue entry to next status as Logo done ' );
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

  comments = 'LOGO_STEP4_QueuedPdfStatusChanged_LOGO COMPLETE - Queued Pdf entry now at status ' + p.statusTo; 

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
           log.v( p.pdf + ' finalStep - Logo Processing Complete ' );
           p.cbWhenDone( null ); 
         }
       });
     } else {
       log.d( 'No Connection to release - Finished so return' );
       log.v( p.pdf + ' finalStep - Logo Processing Complete ' );
       p.cbWhenDone( null ); 
      }
    }
  }); 
}
