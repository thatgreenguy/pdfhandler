var async = require( 'async' ),
  oracledb = require( 'oracledb' ),
  moment = require( 'moment' ),
  log = require( './common/logger.js' ),
  audit = require( './common/audit.js' ),
  jdeEnv = process.env.JDE_ENV,
  jdeEnvDb = process.env.JDE_ENV_DB,
  credentials = { user: process.env.DB_USER, password: process.env.DB_PWD, connectString: process.env.DB_NAME },
  timeOffset = 0;
  

module.exports.getNewPdf = function(  pargs, cbWhenDone ) {

  var p = {},
    sql,
    binds = [],
    options = {},
    row;

  log.d( 'Get Connection to query for any new PDF entries since last PDF Job added to Queue' );

  oracledb.getConnection( credentials, function( err, dbc ) {

    if ( err ) {
      log.e( ' Unable to get Jde DB connection : ' + err );     
      return cbWhenDone( err );
    }  

    sql = "SELECT jpfndfuf2, jpyexpst, jpblkk, jpupmj, jpupmt FROM " + jdeEnvDb.trim() + ".F559811 ";
    sql += " WHERE jpyexpst = " + pargs.processStatusFrom;
    log.d( sql );
    dbc.execute( sql, binds, options, function( err, result ) {

      if ( err ) {
        log.e( ' Jde Db Query execution failed : ' + err );
        dbc.release( function( err ) {
          if ( err ) {
            log.e( ' Unable to release Jde Db connection : ' + err );
            return cbWhenDone( err );
          }
        });     
        return cbWhenDone( err );
      }  

      pargs.pdfFoundCount = result.rows.length;
      pargs.newPdfRows = result.rows;
      log.d( 'Read following rows from Jde Job Control : ' + result );
      dbc.release( function( err ) {
        if ( err ) {
          log.e( ' Unable to release Jde Db connection : ' + err );
          return cbWhenDone( err );
        }
        return cbWhenDone( null, row );
      });          
    });
  });

}
