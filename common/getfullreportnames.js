var async = require( 'async' ),
  oracledb = require( 'oracledb' ),
  moment = require( 'moment' ),
  log = require( './logger.js' ),
  audit = require( './audit.js' ),
  determinemailingoptions = require( './determinemailingoptions.js' ),
  jdeEnv = process.env.JDE_ENV,
  jdeEnvDb = process.env.JDE_ENV_DB,
  jdeExeHost = process.env.JDE_EXEHOST,
  credentials = { user: process.env.DB_USER, password: process.env.DB_PWD, connectString: process.env.DB_NAME };
  

module.exports.getFullReportVersionNames = function(  parg, cbWhenDone ) {

  var p = {},
    sql,
    binds = [],
    options = {},
    row,
    wka,
    rowCount,
    configVersion = [],
    configReport = [],
    ver,
    opt,
    val,
    tmpobj,
    jdeJobNbr = '';


  // Originally pulling Report and Verison name from jcfndfuf2 but this field has limited space to accomodate full length report (10), version (10) and jobnbr (1-15) as jobnbr grows
  // So as result JDE has a habit of truncating version name over time (as jobnbr gets bigger) - normally you only nottice this on report/versions where longer names have been used.
  // Anyway need full report / verison name in order to correctly retrieve email configuration and check whether this job should be mailed or not.
  // Full details need to be extracted from job control information blob - no truncation there!
  // This function gets and sets the Full Report and Version name for the current Job
  parg.fullReportName = null;
  parg.fullVersionName = null;
  
  log.d( 'Get Connection to query for any Mail configuration setup ' );

  oracledb.getConnection( credentials, function( err, dbc ) {

    if ( err ) {
      log.e( ' Unable to get Jde DB connection : ' + err );     
      return cbWhenDone( err );
    }  

    // Pull any PDFMAIL configuration entries for the current PDF - there could be None, 1 or many entries
    // None = No Mail processing required so signal to update status to 999 'Complete'
    // If 1 or more entries then need to examine them in detail as Version level entries can override Report level ones.
  
    // Need to extract Job number from Job PDF 'REPORTNM_VERNM_JOBNBR_PDF' 
    wka = parg.newPdf.split( '_' );
    jdeJobNbr = wka[ 2 ];

    sql = "SELECT UTL_RAW.CAST_TO_VARCHAR2(DBMS_LOB.SUBSTR(JCSRVBLOBA, 22, 1)) as reportname, UTL_RAW.CAST_TO_VARCHAR2(DBMS_LOB.SUBSTR(JCSRVBLOBA, 22, 23)) as version FROM " + jdeEnvDb.trim() + ".F556110 WHERE jcexehost = '" + jdeExeHost.trim() + "' AND jcjobnbr = '" + jdeJobNbr.trim() + "'";
    log.d( parg.newPdf + ' : ' + sql );
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

      row = result.rows[ 0 ];
      rowCount = result.rows.length;

      if ( rowCount > 0 ) {
 
        // Strip nulls out of returned blob data leaving just characters - note sql uses unique key so only expecting 1 record or none!
        log.d( parg.newPdf + ' : Row : ' + row );
        parg.fullReportName = row[ 0 ].replace( /\u0000/g, '' );
        parg.fullVersionName = row[ 1 ].replace( /\u0000/g, '' );
        log.v( parg.newPdf + ' Full Report / Version Names are: ' + JSON.stringify( parg.fullReportName + ' / ' + parg.fullVersionName ) );
      
      } else {

        // No PDFMAIL config at all for this Report/Version so definitely not sending email here - return to caller
        log.d( parg.newPdf + ' : No matching JDE Job Control Record Found : Unable to process email for this job ' );

      }
     
      // Ensure connection resource released then return
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
