// domail.js 
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
  mail = require( './mail.js' ),
  dirRemoteJdePdf = process.env.DIR_JDEPDF,
  dirLocalJdePdf = process.env.DIR_SHAREDDATA;


module.exports.doMail = function( dbp, dbc, hostname, row, jdedate, jdetime, statusTo, cbWhenDone ) {

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
    function( next ) { mailReport( p, next ) } 
//    function( next ) { updateProcessQueueStatus( p, next ) } 
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


// Fetch the Email configuration for this Report and Version
function mailReport( p, cb  ) {

  var pdfInput,
    pdfOutput,
    cmd;

  log.v( p.pdf + ' Step 2 - Check Mail Config for Report/Version and Email Report if required ' );

  domail.prepMail( p.pdf, mailOptions, function( err, result ) {
    if ( err ) {

      log.i( 'doMail: Error ' + err );
      return cb( err )

    } else {

      log.i( 'doMail: OK ' + result );
      return cb( null )

    }
  }); 
  
}



// Create Audit record signalling PDF has been processed for Mailing
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


// Update Pdf entry in JDE Process Queue from current status to next Status
// E.g. When Mail processing done change Pdf Queue entry status from say 200 to 999 (Complete)
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
       log.v( p.pdf + ' finalStep - Mail Processing Complete ' );
       p.cbWhenDone( null ); 
      }
    }
  }); 
}
