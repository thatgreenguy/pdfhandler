var async = require( 'async' ),
  oracledb = require( 'oracledb' ),
  log = require( './logger.js' ),
  audit = require( './audit.js' ),
  hostname = process.env.HOSTNAME,
  jdeEnv = process.env.JDE_ENV,
  jdeEnvDb = process.env.JDE_ENV_DB,
  jdeEnvDbF556110 = process.env.JDE_ENV_DB_F556110,
  credentials = { user: process.env.DB_USER, password: process.env.DB_PWD, connectString: process.env.DB_NAME };
  

module.exports.updatePdfStatus = function( pargs, cbWhenDone ) {

  var p = {},
    sql,
    binds = [],
    options = { autoCommit:true },
    newPdf;
    dt = new Date(),
    timestamp = audit.createTimestamp( dt ),
    jdetime = audit.getJdeAuditTime( dt ),
    jdedate = audit.getJdeJulianDate( dt );


  newPdf = pargs.newPdfRow[ 0 ];
  log.d( newPdf + ' : Get Connection for Update' );

  oracledb.getConnection( credentials, function( err, dbc ) {

    if ( err ) {
      log.e( newPdf + ' : Unable to get Jde DB connection : ' + err );     
      return cbWhenDone( err );
    }  
  
    sql = "UPDATE " + jdeEnvDb.trim() + ".F559811 SET jpyexpst = '" + pargs.processStatusTo + "' WHERE jpfndfuf2 = '" + newPdf + "'";
    log.debug( sql );

    dbc.execute( sql, binds, options, function( err, result ) {

      if ( err ) {
        log.e( newPdf + ' : Jde Db Query update failed : ' + err );
        dbc.release( function( err ) {
          if ( err ) {
            log.e( newPdf + ' : Unable to release Jde Db connection : ' + err );
            return cbWhenDone( err );
          }
        });     
        return cbWhenDone( err );
      }  

      dbc.release( function( err ) {
        if ( err ) {
          log.e( newPdf + ' : Unable to release Jde Db connection : ' + err );
          return cbWhenDone( err );
        }
        return cbWhenDone( null, pargs.newPdf + ' Status updated to ' + pargs.processStatusTo );
      });          
    });
  });

}
