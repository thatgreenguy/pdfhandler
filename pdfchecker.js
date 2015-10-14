// pdfchecker.js  : Check Jde Job Control table looking for any recently generated Pdf files that are configured 
//                : in JDE for some kind of post Pdf processing when found add them to process Queue.
// Author         : Paul Green
// Dated          : 2015-09-21
//
// Synopsis
// --------
//
// Called periodically by pdfmonitor.js
// It checks the Jde Job Control Audit table looking for recently completed UBE reports.
// New PDF files are cross checked against JDE email configuration and if some kind of post pdf processing is required
// e.g. Logos or mailing then the Jde Job is added to the F559811 DLINK Post PDF Handling Queue

var moment = require( 'moment' ),
  log = require( './common/logger.js' ),
  odb = require( './common/odb.js' ),
  audit = require( './common/audit.js' );
  

// Functions -
//
// module.exports.queryJdeJobControl = function(  dbp, monitorFromDate, monitorFromTime, pollInterval, timeOffset, cb )


// Grab a connection from the Pool, query the database for the latest Queue entry
// release the connection back to the pool and finally return to caller with date/time of last entry
module.exports.queryJdePdfProcessQueue = function(  dbp, hostname, statusFrom, statusTo, cb ) {

  var response = {},
  cn = null,
  checkStarted,
  checkFinished,
  duration,
  query,
  binds = [],
  rowBlockSize = 5,
  options = { resultSet: true, prefetchRows: rowBlockSize };

  response.error = null;
  response.result = null;
  checkStarted = new Date();

  query = constructQuery( statusFrom, statusTo );

  log.d( 'Check Started: ' + checkStarted );


  odb.getConnection( dbp, function( err, dbc ) {

    if ( err ) {
      log.w( 'Failed to get an Oracle connection to use for F559811 Query Check - will retry next run' );
      return cb;
    }

    dbc.execute( query, binds, options, function( err, results ) {

      if ( err ) throw err;   

      // Recursivly process result set until no more rows
      function processResultSet( dbc ) {

        results.resultSet.getRows( rowBlockSize, function( err, rows ) {

          if ( err ) {
            log.w( 'Error encountered trying to query F559811 - release connection and retry ' + err );
            dbc.release( function( err ) {

              log.d( 'Error releasing F556110 Connection: ' + err );

              // Once connection release can return to continue monitoring
              return cb( null, dbp );

            });
          }

          if ( rows.length ) {
            
            processRows( dbp, dbc, rows, statusFrom, statusTo, hostname );

            // Process subsequent block of records
            processResultSet( dbc ); 
 
            return;

          }


          checkFinished = new Date();
          log.v( 'Check Finished: ' + checkFinished + ' took ' + (checkFinished - checkStarted) + ' milliseconds' );

          results.resultSet.close( function( err ) { 
          if ( err ) log.d( 'Error closing F559811 result set: ' + err );

            dbc.release( function( err ) {
            if ( err ) log.d( 'Error releasing F559811 Connection: ' + err );

            // Once connection release can return to continue monitoring
            return cb( null, dbp );

            });
          });
        });
      }

      // Process first block of records
      processResultSet( dbc );


    });
  });
}


// Process block of rows - type of post Pdf handling will depend on status
function processRows ( dbp, dbc, rows, statusFrom, statusTo, hostname ) { 

  if ( rows.length ) {

    rows.forEach( function( row ) {

      log.d( 'Processing : ' + row + ' - then updating to status: ' + statusTo );

      }
    });
  }

}



// Construct query to select entries that require processing according to passed status codes
//
// Status 100 => Apply Logo to PDF
// Status 200 => Email PDF
//
function constructQuery( statusFrom, statusTo ) {

  var query = null;

  // Query F559811 by status codes to retrieve a list of PDF that require processing

  query = "SELECT jpfndfuf2, jpyexpst, jpblkk, jpupmj, jpupmt FROM testdta.F559811 ";
  query += " WHERE jpyexpst = ' + statusFrom;

  log.d( query );

  return query;

}
