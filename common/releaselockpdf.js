var async = require( 'async' ),
  oracledb = require( 'oracledb' ),
  log = require( './logger.js' ),
  audit = require( './audit.js' ),
  hostname = process.env.HOSTNAME,
  jdeEnv = process.env.JDE_ENV,
  jdeEnvDb = process.env.JDE_ENV_DB,
  jdeEnvDbF556110 = process.env.JDE_ENV_DB_F556110,
  credentials = { user: process.env.DB_USER, password: process.env.DB_PWD, connectString: process.env.DB_NAME };
  

module.exports.releaseLockPdf = function( parg, cbWhenDone ) {

  var p = {},
    sql,
    binds = [],
    options = { autoCommit:true },
    newPdf,
    jcfndfuf2 = parg.newPdfRow[ 0 ],
    jcprocessid = parg.newPdfRow[ 3 ],
    dt = new Date(),
    timestamp = audit.createTimestamp( dt ),
    jdetime = audit.getJdeAuditTime( dt ),
    jdedate = audit.getJdeJulianDate( dt ),
    jdetime = audit.getJdeAuditTime( dt );

  
  newPdf = parg.newPdfRow[ 0 ];
  log.d( newPdf + ' : Get Connection for Release Lock' );

  oracledb.getConnection( credentials, function( err, dbc ) {

    if ( err ) {
      log.e( newPdf + ' : Unable to get Jde DB connection : ' + err );     
      return cbWhenDone( err );
    }  

    sql = "DELETE FROM " + jdeEnvDb.trim() + ".F559858 WHERE lkfndfuf2 = '" + jcfndfuf2 + "'";
    binds = [];
    options = { autoCommit: true };
    log.debug( sql );

    dbc.execute( sql, binds, options, function( err, result ) {

      if ( err ) {
        log.e( newPdf + ' : Jde Db Query delete failed : ' + err );
        dbc.release( function( err ) {
          if ( err ) {
            log.e( newPdf + ' : Unable to release Jde Db connection : ' + err );
            return cbWhenDone( err );
          }
        });     
        return cbWhenDone( err );
      }  

      log.v( parg.newPdf + ' : Lock Released : ' );
      dbc.release( function( err ) {
        if ( err ) {
          log.e( parg.newPdf + ' : Unable to release Jde Db connection : ' + err );
          return cbWhenDone( err );
        }
        return cbWhenDone( null, parg.newPdf + ' Released' );
      });          
    });
  });

}
