// needlogo        : Checks given PDF entry to see if Logo should be applied
// Author          : Paul Green
// Dated           : 2015-10-14
//
// Synopsis
// --------
//
// Use this module to check the last entry made to the queue or add a new entry to the queue

var oracledb = require( 'oracledb' ),
  log = require( './logger.js' ),
  audit = require( './audit.js' ),
  jdeDB = process.env.JDEDB,
  hostname = process.env.HOSTNAME;


// Functions -
//


// Grab a connection from the Pool, query the database for the given PDF file to see if Logo processing is required
module.exports.logoRequired = function( dbc, pdf, cb ) {

  var wkSplit = [],
    query,
    binds = [],
    options = { resultSet: true };

  wkSplit = pdf[ 0 ].split( '_');

  query = "SELECT crblkk FROM testdta.F559890 WHERE ";
  query += " crpgm = '" + wkSplit[ 0 ] + "' AND ";
  query += " crblkk = 'LOGO' AND crcfgsid = 'PDFHANDLER' AND ";
  query += " ( crvernm = '*ALL' OR crvernm = '" + wkSplit[ 1 ] + "' ) ";

  log.d( 'PDF Report is : ' + wkSplit[ 0 ] + ' and Version is : ' + wkSplit[ 1 ] );
  log.d( query );

  dbc.execute( query, binds, options, function( err, rs ) {

    if ( err ) { 

      log.e( ' Failed to get result from query ' + err );
      cb ( err );

    } else {

      rs.resultSet.getRows( 1, function( err, rows ) {

        if ( err ) {

          log.e( 'Failed to get Row from resultset' );
          log.e( err );

          rs.resultSet.close( function( err ) {

            if (  err ) {

              return cb( err );

            } else {

              return cb( err );

            }
          });

        } else {

          if ( rows ) {

            log.d( 'PDF configured for Logo processing ' + rows[ 0 ] ); 
          rs.resultSet.close( function( err ) {

            if (  err ) {

              return cb( err );

            } else {

              return cb( null, rows[ 0 ] );

            }
          });
            

          } else {

            log.d( 'PDF ' + pdf + ' Not configured for Logo processing' );
          rs.resultSet.close( function( err ) {

            if (  err ) {

              return cb( err );

            } else {

              return cb( null, null );

            }
          });

          }

        }
      });
    }
  });

}


// Update F559811 JDE PDF Process Queue entry - Move to next status
module.exports.moveToNextStatus = function( dbc, row, statusFrom, statusTo, cb ) {

  var query,
    binds = [],
    options = { autoCommit: true };

    query = "UPDATE testdta.F559811 SET jpyexpst = :statusto WHERE jpfndfuf2 = :pdfname AND jpyexpst = :statusfrom";

    log.e( dbc );
    log.e( JSON.stringify( dbc )  );

    log.e( 'UPDATE status of F559811 : ' + row[ 0 ] + ' from: ' + statusFrom + ' To: ' + statusTo + ' Query: ' + query );

    binds.push( statusTo );
    binds.push( row[ 0 ] );
    binds.push( statusFrom );

    dbc.execute( query, binds, options, function( err, result ) {

      if ( err ) {
      
        result = row[ 0 ] + ' UPDATE FAILED ' + err;
        return cb( err );

      } else {

        result = row[ 0 ] + ' UPDATED' ;
        return cb( null );
      }

    });

}
// Module		: audit.js
// Description		: Common Audit file logging related functions.
// Author		: Paul Green
// Dated		: 2015-08-03
//
