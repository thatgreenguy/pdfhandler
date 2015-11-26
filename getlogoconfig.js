var async = require( 'async' ),
  oracledb = require( 'oracledb' ),
  moment = require( 'moment' ),
  log = require( './common/logger.js' ),
  audit = require( './common/audit.js' ),
  jdeEnv = process.env.JDE_ENV,
  jdeEnvDb = process.env.JDE_ENV_DB,
  credentials = { user: process.env.DB_USER, password: process.env.DB_PWD, connectString: process.env.DB_NAME },
  timeOffset = 0;
  

module.exports.getLogoConfig = function(  pargs, cbWhenDone ) {

  var p = {},
    sql,
    binds = [],
    options = {},
    row,
    wka,
    rowCount,
    configVersion = null,
    configAll = null;

  pargs.applyLogo = 'N';
  pargs.logoConfig = '';

  log.d( 'Get Connection to query for any Logo configuration setup ' );

  wka = pargs.newPdf.split("_");

  pargs.pdfReportName = wka[0];
  pargs.pdfVersionName = wka[1];

  log.d( pargs.newPdf + ' : Report Name : ' + pargs.pdfReportName );
  log.d( parg.newPdf + ' : Version Name : ' + pargs.pdfVersionName );

  oracledb.getConnection( credentials, function( err, dbc ) {

    if ( err ) {
      log.e( ' Unable to get Jde DB connection : ' + err );     
      return cbWhenDone( err );
    }  

    // Pull any PDFLOGO configuration entries for the current PDF - there should be either; None, 1 or 2 entries
    // None = No logo processing required
    // If '*ALL' version entry then Logo config is applicable to any version of this Report
    // If Version specific entry then Logo config is applicable ONLY to the current PDF report version
  
    sql = "SELECT crtaskmisc, crvernm FROM " + jdeEnvDb.trim() + ".F559890 WHERE crcfgsid = 'PDFLOGO' AND crpgm = '";
    sql += p.pdfReportName + "' AND ( crvernm = '" + p.pdfVersionName + "' OR crvernm = '*ALL' ) " ;
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

      // Check returned rows and set applyLogo indicator and config setup data applicable to this Report/Version 

      rows = result.rows;
      rowCount = result.rows.length;

      if ( rowCount > 0 ) {
 
        pargs.applyLogo = 'Y';
        
        for ( var i = 0; i < rowCount; i++ ) {

          row = result.rows[ i ];

          if ( pargs.pdfVersionName == row[ 1 ] ) { 

            configVersion = row[ 0 ];

          } else {

            configAll = row[ 0 ]

          }
        }

        // Have now checked all None, 1 or 2 config rows need to decide if using Logo config for *ALL or specific Version
        if ( configVersion !== null ) {
      
          log.d( pargs.newPdf + ' : Version specific config applies : ' + configVersion );
          pargs.logoConfig = configVersion;

        } else {

          log.d( pargs.newPdf + ' : Report config applies : ' + configAll );
          pargs.logoConfig = configAll;

        }

      } else {

        log.d( pargs.newPdf + ' : No PDFLOGO config found );

      }
     
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
