var async = require( 'async' ),
  oracledb = require( 'oracledb' ),
  moment = require( 'moment' ),
  log = require( './logger.js' ),
  audit = require( './audit.js' ),
  jdeEnv = process.env.JDE_ENV,
  jdeEnvDb = process.env.JDE_ENV_DB,
  credentials = { user: process.env.DB_USER, password: process.env.DB_PWD, connectString: process.env.DB_NAME };
  

module.exports.getLogoConfig = function(  parg, cbWhenDone ) {

  var p = {},
    sql,
    binds = [],
    options = {},
    row,
    wka,
    rowCount,
    configVersion = null,
    configAll = null;

  parg.applyLogo = 'N';
  parg.logoConfig = '';

  log.d( 'Get Connection to query for any Logo configuration setup ' );

  wka = parg.newPdf.split("_");

  parg.pdfReportName = wka[0];
  parg.pdfVersionName = wka[1];

  log.d( parg.newPdf + ' : Report Name : ' + parg.pdfReportName );
  log.d( parg.newPdf + ' : Version Name : ' + parg.pdfVersionName );

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
    sql += parg.pdfReportName + "' AND ( crvernm = '" + parg.pdfVersionName + "' OR crvernm = '*ALL' ) " ;
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

      log.d( parg.newPdf + ' : rows     : ' + rows );
      log.d( parg.newPdf + ' : rowCount : ' + rowCount );

      if ( rowCount > 0 ) {
 
        parg.applyLogo = 'Y';
        
        for ( var i = 0; i < rowCount; i++ ) {

          row = result.rows[ i ];
          log.d( parg.newPdf + ' : row     : ' + row );
          log.d( parg.newPdf + ' : row     : ' + row[ 1 ] );
          log.d( parg.newPdf + ' : pdfVersionName : ' + parg.pdfVersionName );

          if ( parg.pdfVersionName == row[ 1 ].trim() ) { 

            configVersion = row[ 0 ];

          } else {

            configAll = row[ 0 ]

          }
        }

        log.d( parg.newPdf + ' : Report Config  : ' + configAll );
        log.d( parg.newPdf + ' : Version Config : ' + configVersion );

        // Have now checked all None, 1 or 2 config rows need to decide if using Logo config for *ALL or specific Version
        if ( configVersion !== null ) {
      
          log.d( parg.newPdf + ' : Version specific config applies : ' + configVersion );
          parg.logoConfig = configVersion;

        } else {

          log.d( parg.newPdf + ' : Report config applies : ' + configAll );
          parg.logoConfig = configAll;

        }

	// Code patch for dealing with jobs that produce no PDF files resulting in copy failure and queued entries stuck at 100
	// logoConfig will be *ALL or version specific at this point so check value and set if Logo is required or not
	if ( parg.logoConfig == 'N' ) {
		// No Logo will be applied and job queue entry will advance to status 200
		log.w( parg.newPdf + ' : LOGO Disabled' );
		parg.applyLogo = 'N';
	} else {
		log.w( parg.newPdf + ' : LOGO Required' );
		parg.applyLogo = 'Y';
	}


      } else {

        log.d( parg.newPdf + ' : No PDFLOGO config found ' );

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
