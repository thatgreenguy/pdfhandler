// dologo.js 
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

  var pargs;

  pargs = { 'dbp': dbp, 
          'dbc': dbc, 
          'hostname': hostname,
          'row': row,
          'pdf': row[ 0 ],
          'jdedate': jdedate,
          'jdetime': jdetime,
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
    function( next ) { confirmLogoReady( p, next ) }, 
    function( next ) { copyPdf( p, next ) }, 
    function( next ) { applyLogo( p, next ) }, 
    function( next ) { replaceJdePdf( p, next ) }, 
    function( next ) { updateProcessQueueStatus( p, next ) } 
//    function( next ) { writeAuditEntry( p, next ) }

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

  log.v( p.pdf + ' Step 1 - Place Lock on this PDF file ' );

  lock.placeLock( p.mycn, p.row, p.hostname, function( err, result ) {
    if ( err ) {
      return cb( err )
    } else {
      return cb( null )
    }
  }); 
}


// Check Audit to make sure it has not been recently processed by any other instance of this app
function confirmLogoReady( p, cb  ) {

  log.v( p.pdf + ' Step 2 - Check PDF definitely not yet had Logo applied ' );
  
  return cb( null )

}


// Make a backup copy of the original JDE PDF file
function copyPdf( p, cb  ) {

  var cmd;

  log.v( p.pdf + ' Step 3 - Backup Original PDF ' );
  
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
  
//  return cb( null )

}


// Apply Logo to each page
function applyLogo( p, cb  ) {

  log.v( p.pdf + ' Step 4 - Apply Logo ' );
  
  return cb( null )

}


// Replace JDE generated PDF file with modified Logo copy
function replaceJdePdf( p, cb  ) {

  log.v( p.pdf + ' Step 5 - Replace JDE PDF in PrintQueue with Logo version ' );
  
  return cb( null )

}


// Create Audit record signalling PDF has been processed for Logo
function writeAuditEntry( p, cb  ) {

  log.v( p.pdf + ' Step 6 - Write Audit Entry ' );
  audit.createAuditEntry( p.dbc, p.pdf, p.row[ 2 ], p.hostname, p.statusTo, function( err, result ) {
    if ( err ) {
      return cb( err )
    } else {
      return cb( null )
    }
  }); 
  
}


// Update Pdf entry in JDE Process Queue from current statsu to next Status
// E.g. When Logo processing done change Pdf Queue entry status from say 100 to 200 (Email check next)
function updateProcessQueueStatus( p, cb  ) {

  log.v( p.pdf + ' Step 7 - Update PDF process Queue entry to next status as Logo done ' );
  audit.updatePdfQueueStatus( p.dbc, p.pdf, p.row[ 2 ], p.hostname, p.statusTo, function( err, result ) {
    if ( err ) {
      return cb( err )
    } else {
      return cb( null )
    }
  }); 
  
}


// Release Lock entry for this PDF - Called when processing complete or if error
function finalStep( p  ) {

  log.v( p.pdf + ' finalStep - Release Lock ' );

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






// Called when exclusive lock has been successfully placed to process the PDF file
function OLDprocessLockedPdfFile(dbCn, record, hostname ) {

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
function OLDprocessPDF( record, hostname ) {

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



// Make a backup copy of the original JDE PDF file - just in case we need the untouched original
// These can be purged inline with the normal JDE PrintQueue - currently PDF's older than approx 2 months
function OLDcopyJdePdfToWorkDir( parms, cb ) {

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
function OLDapplyLogo( parms, cb ) {

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
function OLDreplaceJdePdfWithLogoVersion( parms, cb ) {

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


function OLDcreateAuditEntry( parms, cb ) {

  // Create Audit entry for this Processed record - once created it won't be processed again
  audit.createAuditEntry( parms.jcfndfuf2, parms.genkey, parms.hostname, "PROCESSED - LOGO" );
  log.verbose( "JDE PDF " + parms.jcfndfuf2 + " - Audit Record written to JDE" );
  cb( null, "Audit record written" );
}




