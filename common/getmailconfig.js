var async = require( 'async' ),
  oracledb = require( 'oracledb' ),
  moment = require( 'moment' ),
  log = require( './logger.js' ),
  audit = require( './audit.js' ),
  jdeEnv = process.env.JDE_ENV,
  jdeEnvDb = process.env.JDE_ENV_DB,
  credentials = { user: process.env.DB_USER, password: process.env.DB_PWD, connectString: process.env.DB_NAME };
  

module.exports.getMailConfig = function(  parg, cbWhenDone ) {

  var p = {},
    sql,
    binds = [],
    options = {},
    row,
    wka,
    rowCount,
    configVersion = null,
    configAll = null,
    ver,
    opt,
    val,
    wka;

  parg.sendEmail = 'N';
  parg.mailConfig = '';

  log.d( 'Get Connection to query for any Mail configuration setup ' );

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

    // Pull any PDFMAIL configuration entries for the current PDF - there could be None, 1 or many entries
    // None = No Mail processing required so signal to update status to 999 'Complete'
    // If 1 or more entries then need to examine them in detail as Version level entries can override Report level ones.
  
    sql = "SELECT crvernm, crblkk, crtaskmisc  FROM " + jdeEnvDb.trim() + ".F559890 WHERE crcfgsid = 'PDFMAIL' AND crpgm = '";
    sql += parg.pdfReportName + "' AND ( crvernm = '" + parg.pdfVersionName + "' OR crvernm = '*ALL' ) ORDER BY CRBLKK, CRVERNM" ;
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

      // Check returned rows set sendEmail indicator and merge Report level and version level configuration options 
      // Options can be configured at Report level or Version Level and if same option is configured at both levels then
      // Version level option trumps or overrides the report level one

      rows = result.rows;
      rowCount = result.rows.length;

      log.d( parg.newPdf + ' : rows     : ' + rows );
      log.d( parg.newPdf + ' : rowCount : ' + rowCount );
      
      parg.mailOptions = [];
      parg.versionOptions = [];
      
      if ( rowCount > 0 ) {
 
        // We have some configuration options so could be sending email here but depends on the 'EMAIL' option being Y or N
        // Merge all options for this Report/Version then cehck the 'EMAIL' option   
        
        for ( var i = 0; i < rowCount; i++ ) {

          row = result.rows[ i ];
          ver = row[ 0 ];
          opt = row[ 1 ];
          val = row[ 2 ];
          
          // Sort version and report level options - initially mailoptions holds just report level options.
          if ( ver == parg.pdfVersionName ) {
            parg.versionOptions[ opt ] = val;
          } else {
            parg.mailOptions.opt = val;
          }
        }

        log.d( parg.newPdf + ' : Report Config  : ' + JSON.stringify( parg.mailOptions) );
        log.d( parg.newPdf + ' : Version Config : ' + JSON.stringify( parg.versionOptions );

        // Iterate over Version level options and check to see if each exists in mailOptions or not
        // If found replace Report Level option with Version override
        // If not found then add Version level option

        for ( var i = 0; i < rowCount; i++ ) {



    
        // Extract array of Key values from Version Options 
        wka = Object.keys( versionOptions )

        // Iterate over Version Options check mailOptions if not there add otherwise replace value
         


      } else {

        // No PDFMAIL config at all for this Report/Version so definitely not sending email here - return to caller
        log.d( parg.newPdf + ' : No PDFMAIL config found ' );

      }
     
      // Ensure conenction resource released then return
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
