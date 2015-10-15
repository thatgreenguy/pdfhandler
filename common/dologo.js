// 
//
//
//


var oracledb = require( 'oracledb' ),
  async = require( 'async' ),
  exec = require( 'child_process' ).exec,
  odb = require( './odb.js' ),
  lock = require( './lock.js' ),
  log = require( './logger.js' ),
  audit = require( './audit.js' ),
  dirRemoteJdePdf = process.env.DIR_JDEPDF,
  dirLocalJdePdf = process.env.DIR_SHAREDDATA;


module.exports.doLogo = function( dbp, dbc, hostname, row, jdedate, jdetime, statusTo, cbWhenDone ) {

var p;

  // Get connection to use
  oracledb.getConnection( dbp, function( err, cn ) {

    if ( err ) { 
      log.e( 'Wot No Connection ' + err );
      return cbWhenDone( err );

    } else {

  p = { 'dbp': dbp, 
          'dbc': dbc, 
          'hostname': hostname,
          'row': row,
          'pdf': row[ 0 ],
          'jdedate': jdedate,
          'jdetime': jdetime,
          'statusTo': statusTo,
          'mycn': cn,
          'cbWhenDone': cbWhenDone };

  log.w( 'START p : ' + JSON.stringify( p ));

  async.series([
    function( next ) { s1( p, next ) }, 
    function( next ) { s2( p, next ) }, 
    function( next ) { s3( p, next ) }, 
    function( next ) { s4( p, next ) }, 
    function( next ) { s5( p, next ) }, 
    function( next ) { s6( p, next ) }

  ], function( err, resp ) {

    log.w( 'END p : ' + JSON.stringify( p ));    
    
    if ( err ) {

      log.d( 'Async series experienced error' + err );
      s7( p, function( err ) {

        if ( err ) {
          cbWhenDone( err );
        } else {
          cbWhenDone( null );
        }
      }); 

    } else {

      log.d( 'Async series Done' );
      s7( p, function( err ) {

        if ( err ) {
          cbWhenDone( err );
        } else {
          cbWhenDone( null );
        }
      }); 
    }

  });

  }
  });
 
}


// Get exclusive Lock for this PDF
function s1( p, cb  ) {

  log.d( 'Step 1 Place Lock on this PDF file ' + p.pdf );

  lock.placeLock( p.mycn, p.row, p.hostname, function( err, result ) {
    if ( err ) {
      return cb( err )
    } else {
      return cb( null )
    }
  }); 
}

// Check Audit to make sure it has not been recently processed by any other instance of this app
function s2( p, cb  ) {

  log.d( 'Step 2 Check PDF definitely not yet had Logo applied ' + p.pdf );
  
  return cb( null )

}
// Make a backup copy of the original JDE PDF file
function s3( p, cb  ) {

  log.d( 'Step 3 Backup Original PDF ' + p.pdf );
  
  return cb( null )

}

// Apply Logo to each page
function s4( p, cb  ) {

  log.d( 'Step 4 Apply Logo ' + p.pdf );
  
  return cb( null )

}
// Replace JDE generated PDF file with modified Logo copy
function s5( p, cb  ) {

  log.d( 'Step 5 Replace JDE PDF in PrintQueue with Logo version ' + p.pdf );
  
  return cb( null )

}

// Create Audit record signalling PDF has been processed for Logo
function s6( p, cb  ) {

  log.d( 'Step 6 Write Audit Entry ' + p.pdf );
  audit.createAuditEntry( p.dbc, p.pdf, p.row[ 2 ], p.hostname, p.statusTo, function( err, result ) {
    if ( err ) {
      return cb( err )
    } else {
      return cb( null )
    }
  }); 
  
}

// Release Lock entry for this PDF - Called when processing complete or if error
function s7( p, cb  ) {

  log.d( 'Step 7 Release Lock ' + p.pdf );

  lock.removeContainerLock( p.dbp, p.row, p.hostname, function( err, result ) {
    if ( err ) {
      return cb( err )
    } else {
      return cb( null )
    }
  }); 
}




// Called to handle processing of first and subsequent 'new' PDF Entries detected in JDE Output Queue  
function processPdfEntry( dbCn, rsF556110, begin, jobControlRecord, firstRecord, pollInterval, hostname, lastPdf, performPolledProcess ) {

  var cb = null,
    currentPdf;

  currentPdf = jobControlRecord[ 0 ];
  log.verbose('Last PDF: ' + lastPdf + ' currentPdf: ' + currentPdf );

  // If latest JDE Pdf job name does not match the previous one we have a change so check and process in detail 
  if ( lastPdf !== currentPdf ) {

    log.debug(" Last PDF: " + lastPdf + ' Current one: ' + currentPdf );
    log.info( "          >>>>  CHANGE detected in JDE Output Queue <<<<");

    // Before processing recently noticed PDF file(s) first check mount points and re-establish if necessary
    var cb = function() { processLockedPdfFile( dbCn, jobControlRecord, hostname ); }
    lock.gainExclusivity( jobControlRecord, hostname, dbCn, cb );
      
  }           

/*  if ( firstRecord ) {

    firstRecord = false;
    currentPdf = jobControlRecord[ 0 ];

    log.verbose('First Record: ' + firstRecord + ' processPdfEntry: ' + jobControlRecord );
    // If latest JDE Pdf job name does not match the previous one we have a change so check and process in detail 
    if ( lastPdf !== currentPdf ) {

      log.debug(" Last PDF file : " + lastPdf);
      log.debug(" Latest PDF file : " + currentPdf);
//      log.info( " ");
//      log.info( "          >>>>  CHANGE detected in JDE Output Queue <<<<");
//      log.info( " ");

      // Before processing recently noticed PDF file(s) first check mount points and re-establish if necessary
      var cb = function() { processLockedPdfFile( dbCn, jobControlRecord, audit, log, hostname ); }
      lock.gainExclusivity( jobControlRecord, hostname, dbCn, cb );
      
    }           

  } else {

    // Process second and subsequent records.
    var cb = function() { processLockedPdfFile( dbCn, jobControlRecord, audit, log, hostname ); }
    lock.gainExclusivity( jobControlRecord, hostname, dbCn, cb );		
  }
*/

  // Process subsequent PDF entries if any - Read next Job Control record
  processResultsFromF556110( dbCn, rsF556110, numRows, begin, firstRecord, pollInterval, hostname, lastPdf, performPolledProcess );

}


// Called when exclusive lock has been successfully placed to process the PDF file
function processLockedPdfFile(dbCn, record, hostname ) {

    var query,
        countRec,
        count,
        cb = null;

    log.info( 'JDE PDF ' + record[ 0 ] + " - Lock established" );

    // Check this PDF file has definitely not yet been processed by any other pdfHandler instance
    // that may be running concurrently

    query = "SELECT COUNT(*) FROM testdta.F559859 WHERE pafndfuf2 = '";
    query += record[0] + "'";

    dbCn.execute( query, [], { }, function( err, result ) {
        if ( err ) { 
            log.debug( err.message );
            return;
        };

        countRec = result.rows[ 0 ];
        count = countRec[ 0 ];
        if ( count > 0 ) {
            log.info( 'JDE PDF ' + record[ 0 ] + " - Already Processed - Releasing Lock." );
            lock.removeLock( record, hostname );

        } else {
             log.info( 'JDE PDF ' + record[0] + ' - Processing Started' );

             // This PDF file has not yet been processed and we have the lock so process it now.
             // Note: Lock will be removed if all process steps complete or if there is an error
             // Last process step creates an audit entry which prevents file being re-processed by future runs 
             // so if error and lock removed - no audit entry therefore file will be re-processed by future run (recovery)	
             
             processPDF( record, hostname ); 

        }
    }); 
}


// Exclusive use / lock of PDF file established so free to process the file here.
function processPDF( record, hostname ) {

    var jcfndfuf2 = record[ 0 ],
        jcactdate = record[ 1 ],
        jcacttime = record[ 2 ],
        jcprocessid = record[ 3 ],
        genkey = jcactdate + " " + jcacttime,
        parms = null;

    // Make parameters available to any function in series
    parms = { "jcfndfuf2": jcfndfuf2, "record": record, "genkey": genkey, "hostname": hostname };

    async.series([
        function ( cb ) { passParms( parms, cb ) }, 
        function ( cb ) { copyJdePdfToWorkDir( parms, cb ) }, 
        function ( cb ) { applyLogo( parms, cb ) }, 
//        function ( cb ) { replaceJdePdfWithLogoVersion( parms, cb ) },
        function ( cb ) { createAuditEntry( parms, cb ) }
        ], function(err, results) {

             var prms = results[ 0 ];

             // Lose lock regardless whether PDF file proceesed correctly or not
             removeLock( prms );

             // log results of Pdf processing
             if ( err ) {
               log.error("JDE PDF " + prms.jcfndfuf2 + " - Processing failed - check logs in ./logs");
	     } else {
               log.info("JDE PDF " + prms.jcfndfuf2 + " - Processing Complete - Logos added");
             }
           }
    );
}


// Ensure required parameters for releasing lock are available in final async function
// Need to release lock if PDF file processed okay or failed with errors so it can be picked up and recovered by future runs!
// For example sshfs dbCn to remote directories on AIX might go down and re-establish later
function passParms(parms, cb) {

  log.debug( 'passParms' + ' : ' + parms );
  cb( null, parms);  

}


// Make a backup copy of the original JDE PDF file - just in case we need the untouched original
// These can be purged inline with the normal JDE PrintQueue - currently PDF's older than approx 2 months
function copyJdePdfToWorkDir( parms, cb ) {

  var cmd = "cp /home/pdfdata/" + parms.jcfndfuf2 + " /home/shareddata/wrkdir/" + parms.jcfndfuf2.trim() + "_ORIGINAL";

  log.verbose( "JDE PDF " + parms.jcfndfuf2 + " - Make backup copy of original JDE PDF file in work directory" );
  log.debug( cmd );
  exec( cmd, function( err, stdout, stderr ) {
    if ( err !== null ) {
      log.debug( cmd + ' ERROR: ' + err );
      cb( err, cmd + " - Failed" );
    } else {
      cb( null, cmd + " - Done" );
    }
  });
}


// Read original PDF and create new replacement version in working directory with logos added
function applyLogo( parms, cb ) {

  var pdfInput = "/home/shareddata/wrkdir/" + parms.jcfndfuf2.trim() + "_ORIGINAL",
    pdfOutput = '/home/shareddata/wrkdir/' + parms.jcfndfuf2,
    cmd = "node ./src/pdfaddlogo.js " + pdfInput + " " + pdfOutput ;

  log.verbose( "JDE PDF " + parms.jcfndfuf2 + " - Read original creating new PDF in work Directory with logos" );
  log.debug( cmd );
  exec( cmd, function( err, stdout, stderr ) {
    if ( err !== null ) {
      log.debug( cmd + ' ERROR: ' + err );
      log.info( 'Errors when applying Logo: Check but likely due to Logo already applied in prior run: ');
      cb( err, cmd + " - Failed" );
    } else {
      cb( null, cmd + " - Done" );
    }
  });
}


// Replace original JDE PDF File in PrintQueue with amended PDF incuding logos
function replaceJdePdfWithLogoVersion( parms, cb ) {

  var pdfWithLogos = "/home/shareddata/wrkdir/" + parms.jcfndfuf2,
    jdePrintQueue = "/home/pdfdata/" + parms.jcfndfuf2,
    cmd = "mv " + pdfWithLogos + " " + jdePrintQueue;

  log.verbose( "JDE PDF " + parms.jcfndfuf2 + " - Replace JDE output queue PDF with modified Logo version" );
  log.debug( cmd );
  exec( cmd, function( err, stdout, stderr ) {
    if ( err !== null ) {
      log.debug( cmd + ' ERROR: ' + err );
      cb( err, cmd + " - Failed" );
    } else {
      cb( null, cmd + " - Done" );
    }
  });
}


function createAuditEntry( parms, cb ) {

  // Create Audit entry for this Processed record - once created it won't be processed again
  audit.createAuditEntry( parms.jcfndfuf2, parms.genkey, parms.hostname, "PROCESSED - LOGO" );
  log.verbose( "JDE PDF " + parms.jcfndfuf2 + " - Audit Record written to JDE" );
  cb( null, "Audit record written" );
}




