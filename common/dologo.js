var oracledb = require( 'oracledb' ),
  async = require( 'async' ),
  exec = require( 'child_process' ).exec,
  log = require( './logger.js' ),
  mounts = require( './mounts.js' ),
  audit = require( './audit.js' ),
  getlogoconfig = require( './getlogoconfig.js' ),
  auditlog = require( './auditlog.js' ),
  lockpdf = require( './lockpdf.js' ),
  releaselockpdf = require( './releaselockpdf.js' ),
  updatepdfstatus = require( './updatepdfstatus.js' ),
  logoinfo = require( './logoinfo.js' ),
  dirRemoteJdePdf = process.env.DIR_JDEPDF,
  dirLocalJdePdf = process.env.DIR_SHAREDDATA,
  jdeEnv = process.env.JDE_ENV,
  jdeEnvDb = process.env.JDE_ENV_DB;


module.exports.doLogo = function( parg, cbDone ) {

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

      parg.cmd = 'BEGIN LOGO Processing';
      parg.cmdResult = ' ';

      // Check shows Mounts in place so handle Logo Processing
      async.series([
        function( cb ) { auditLog( parg, cb ) },
        function( cb ) { lockPdf( parg, cb ) },
        function( cb ) { auditLog( parg, cb ) },
        function( cb ) { checkConfiguration( parg, cb ) },
        function( cb ) { auditLog( parg, cb ) },
        function( cb ) { copyPdf( parg, cb ) },
        function( cb ) { auditLogOptional( parg, cb ) },
        function( cb ) { applyLogo( parg, cb ) },
        function( cb ) { auditLogOptional( parg, cb ) },
        function( cb ) { replacePdf( parg, cb ) },
        function( cb ) { auditLogOptional( parg, cb ) },
        function( cb ) { updatePdfEntryStatus( parg, cb ) },
        function( cb ) { auditLog( parg, cb ) }

      ], function( err, result ) {

        if ( err ) {

          // When error log last command and result 
          log.w( parg.cmd );
          log.w( parg.cmdResult );

          log.e( parg.newPdf + ' : Error encountered trying to proces Logo : ' + err );
          releaseLockReturn( parg, cbDone );

        } else {

          log.i( parg.newPdf + ' : Logo Processing Completed ' );
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


// Lock PDF for duration of any Logo processing - need exclusive access
//
function lockPdf( parg, cb ) {

  log.v( parg.newPdf + ' : Lock PDF : Exclusivity required for Logo processing ' );
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

  log.v( parg.newPdf + ' : Check Configuration : Is PDF set up for Logo processing? ' );
  parg.cmd = 'CHECK CONFIG | ';
  parg.cmdResult = ' ';

  getlogoconfig.getLogoConfig( parg, function( err, result ) {

    if ( err ) {

      log.e( parg.newPdf + ' : Error trying to get PDFLOGO config/setup : ' + err );    
      parg.cmdResult += 'FAILED : ' + result;
      return cb( err );

    } else {

      if ( parg.applyLogo == 'Y' ) {
        log.v( parg.newPdf + ' : PDFLOGO : Required ' );    
        parg.cmdResult += 'OK : PDFLOGO Required ' + result;
      } else {
        log.v( parg.newPdf + ' : PDFLOGO : Not Required just Advance Status  ' );    
        parg.cmdResult += 'OK : PDFLOGO * Not * Required ' + result;
      }
      return cb( null );

    }
  });  

}


function copyPdf( parg, cb ) {

  var cmd;

  // Copy PDF from JDE Output Queue to working folder (on Aix) - append _ORIGINAL to PDF name
  parg.cmd = 'COPY PDF | ';
  parg.cmdResult = ' ';

  if ( parg.applyLogo != 'Y' ) { 

    log.v( parg.newPdf + ' : SKIP : Copy PDF : Copy original JDE PDF (from Output Queue) to working copy appended with "_ORIGINAL"' );
    return cb( null );

  } else {

    log.v( parg.newPdf + ' : Copy PDF : Copy original JDE PDF (from Output Queue) to working copy appended with "_ORIGINAL"' );
    cmd = "cp /home/pdfdata/" + parg.newPdf + " /home/shareddata/wrkdir/" + parg.newPdf.trim() + "_ORIGINAL";
    parg.cmd += cmd;
    log.d( cmd );

    exec( cmd, function( err, stdout, stderr ) {
      if ( err ) {
        parg.cmdResult += 'FAILED : ' + err;
        log.e( parg.cmdResult );
        return cb( err, parg.cmdResult );

      } else {
        parg.cmdResult += 'OK : ' + stdout + ' ' + stderr;
        log.v( parg.cmdResult );
        return cb( null, parg.cmdResult );

      }
    });
  }

}


function applyLogo( parg, cb ) {

  var pdfInput,
    pdfOutput,
    cmd;


  // Apply Logo image using copy PDF in working folder and creating new PDF with logos in working folder
  parg.cmd = 'APPLY LOGO | ';
  parg.cmdResult = ' ';

  if ( parg.applyLogo != 'Y' ) { 

    log.v( parg.newPdf + ' : SKIP : Apply Logo : create new PDF file in work directory with Logo images applied' );
    return cb( null );

  } else {

    log.v( parg.newPdf + ' : Apply Logo : create new PDF file in work directory with Logo images applied' );
    pdfInput = "/home/shareddata/wrkdir/" + parg.newPdf.trim() + "_ORIGINAL";
    pdfOutput = '/home/shareddata/wrkdir/' + parg.newPdf;
    cmd = "node ./src/pdfaddlogo.js " + pdfInput + " " + pdfOutput;
    parg.cmd += cmd;
    log.d( cmd );

    exec( cmd, function( err, stdout, stderr ) {
      if ( err ) {
        parg.cmdResult += 'FAILED : ' + err;
        log.e( parg.cmdResult );
        return cb( err, parg.cmdResult );

      } else {
        parg.cmdResult += 'OK : ' + stdout + ' ' + stderr;
        log.v( parg.cmdResult );
        return cb( null, parg.cmdResult );

      }
    });
  }

}


function replacePdf( parg, cb ) {

  var pdfInput,
    pdfOutput,
    cmd;

  // Apply Logo image using copy PDF in working folder and creating new PDF with logos in working folder
  parg.cmd = 'REPLACE PDF | ';
  parg.cmdResult = ' ';

  if ( parg.applyLogo != 'Y' ) { 

    log.v( parg.newPdf + ' : SKIP : Replace original Pdf : with Logo version in JDE Print Queue' );
    return cb( null );

  } else {

    log.v( parg.newPdf + ' : Replace original Pdf : with Logo version in JDE Print Queue' );
    pdfWithLogos = "/home/shareddata/wrkdir/" + parg.newPdf;
    jdePrintQueue = "/home/pdfdata/" + parg.newPdf,
    cmd = "mv " + pdfWithLogos + " " + jdePrintQueue;
    parg.cmd += cmd;
    log.d( cmd );

    exec( cmd, function( err, stdout, stderr ) {
      if ( err ) {
        parg.cmdResult += 'FAILED : ' + err;
        log.e( parg.cmdResult );
        return cb( err, parg.cmdResult );

      } else {
        parg.cmdResult += 'OK : ' + stdout + ' ' + stderr;
        log.v( parg.cmdResult );
        return cb( null, parg.cmdResult );

      }
    });
  }

}


// Logo processing completed so shuffle PDF Entry to next Status
//
function updatePdfEntryStatus( parg, cb ) {

  parg.cmd = 'UPDATE STATUS | ';
  parg.cmdResult = ' ';

  updatepdfstatus.updatePdfStatus( parg, function( err, result ) {

    if ( err ) {

      log.e( parg.newPdf + ' : Unable to update Process Queue (F559811) Status? ' );  
      parg.cmdResult += 'FAILED : ' + result;
      return cb( err );

    } else {

      log.v( parg.newPdf + ' : Process Queue Status Updated : ' + result );  
      parg.cmdResult += 'OK : ' + result;
      return cb( null );

    }
  });

}


// Logo processing complete without error - release lock
// logo processing errored then release lock anyway - allows attempt to recover on subsequent runs
//
function releaseLockReturn( parg, cbDone ) {

  parg.cmd = 'RELEASE LOCK | ';
  parg.cmdResult = ' ';

  releaselockpdf.releaseLockPdf( parg, function( err, result ) {

    if ( err ) {

      log.e( parg.newPdf + ' : Unable to release Lock on this PDF? ' );  
      parg.cmdResult += 'FAILED : ' + result;
      return cbDone( err );

    } else {

      log.v( parg.newPdf + ' : Lock Released : ' + result );  
      parg.cmdResult += 'OK : ' + result;
      return cbDone( null );

    }
  });

}
