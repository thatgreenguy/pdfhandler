// pdfchecker.js  : Performs a query check on the JDE PDF Process Queue and calls the appropriate handler program 
//                : to add Logos or Mail the JDE report.
// Author         : Paul Green
// Dated          : 2015-09-21
//
// Synopsis
// --------
//
// Called periodically by pdfmonitor.js depending on polling interval
// It checks the Jde PDF Process Queue (F559811) for PDF files queued waiting for post Pdf processing
// such as Logo stamping or report mailing and calls the appropriate handler program.


var moment = require( 'moment' ),
  log = require( './common/logger.js' ),
  odb = require( './common/odb.js' ),
  dologo = require( './common/dologo.js' ),
  domail = require( './common/domail.js' ),
  hostname = process.env.HOSTNAME,
  jdeEnv = process.env.JDE_ENV,
  jdeEnvDb = process.env.JDE_ENV_DB;
  

// Functions -
//
// module.exports.queryJdePdfProcessQueue( dbp, hostname, statusFrom, statusTo, cb )
// constructQuery( statusFrom, statusTo )


// Grab a connection from the Pool, query the database for the latest Queue entry
// release the connection back to the pool and finally return to caller with date/time of last entry
module.exports.queryJdePdfProcessQueue = function( dbp, hostname, statusFrom, statusTo, cb ) {

  var response = {},
  cn = null,
  checkStarted,
  checkFinished,
  duration,
  processCount = 0,
  query,
  binds = [],
  rowBlockSize = 1,
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


      // Process PDF file
      function processPDF( dbp, dbc, row, statusFrom, statusTo, hostname ) { 

        var cb;

        log.i( row );

        // Process subsequent block of records when finished with current Pdf
        cb = function() { processResultSet( dbc ); };

        // If status is 100 then do Logo processing
        // If status is 200 then do Mail processing
        // Otherwise punch warning as not sure what to do with this record - check env variable settings
        if ( row[ 0 ][ 1 ] === '100' ) {

          dologo.doLogo( dbp, dbc, hostname, row[ 0 ], row[ 2 ], row[ 3 ], statusFrom, statusTo, cb );

        } else {
  
          if ( row[ 0 ][ 1 ] === '200' ) {

            domail.doMail( dbp, dbc, hostname, row[ 0 ], row[ 2 ], row[ 3 ], statusFrom, statusTo, cb );

          } else {

            log.w( 'Expected status of 100 or 200 to process Logo or Mail - not sure what to do with : ' + row[ 0 ][ 1 ] );
            log.w( 'Check environment variable settings for running container - particularly PROCESS_STATUS_* values' );
            log.w( 'Should be from 100 to 200 or from 200 to 999 - unless your adding another process to the mix!' );
            log.w( 'Row : ' + row + ' Ignored' );

          }
        }
      }


      // Recursivly process result set until no more rows
      function processResultSet( dbc ) {

        results.resultSet.getRows( rowBlockSize, function( err, row ) {

          if ( err ) {
            log.w( 'Error encountered trying to query F559811 - release connection and retry ' + err );
            dbc.release( function( err ) {

              log.d( 'Error releasing F556110 Connection: ' + err );

              // Once connection release can return to continue monitoring
              return cb( null, dbp );

            });
          }

          if ( row.length ) {
            
            // Keep track of how many PDF files processed in this run
            processCount += row.length;

            // Process PDF file(s)
            //
            // Handle Post PDF processing for block of records just read... 
            processPDF( dbp, dbc, row, statusFrom, statusTo, hostname );

            return;

          }


          checkFinished = new Date();
          log.v( 'Check Finished: ' + checkFinished + ' took ' + (checkFinished - checkStarted) + ' milliseconds' );
          log.v( 'Processed : ' + processCount + ' PDF files' );

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


// Construct query to select entries that require processing according to passed status codes
//
// Status 100 => Apply Logo to PDF
// Status 200 => Email PDF
//
function constructQuery( statusFrom, statusTo ) {

  var query = null;

  // Query F559811 by status codes to retrieve a list of PDF that require processing

  query = "SELECT jpfndfuf2, jpyexpst, jpblkk, jpupmj, jpupmt FROM " + jdeEnvDb.trim() + ".F559811 ";
  query += " WHERE jpyexpst = " + statusFrom;

  log.d( query );

  return query;

}
