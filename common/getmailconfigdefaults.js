var oracledb = require( 'oracledb' ),
  log = require( './logger.js' ),
  jdeEnv = process.env.JDE_ENV,
  jdeEnvDb = process.env.JDE_ENV_DB,
  credentials = { user: process.env.DB_USER, password: process.env.DB_PWD, connectString: process.env.DB_NAME };
  

module.exports.getMailConfigDefaults = function(  parg, cbWhenDone ) {

  var p = {},
    sql,
    binds = [],
    options = {},
    row,
    rowCount;


  // Setting PDF Report Name and Version by splitting PDF Job string 'Rxxxxxx_Vxxxxxx_1234546_PDF' doesn't work long term because as the Job Number
  // grows the JDE system starts to truncate the Version Name. Luckily the Job Control record has a blob which contains the full report name and version name
  // So use them instead to ensure we always read the correct Mail configuration
  parg.pdfReportName = parg.fullReportName;
  parg.pdfVersionName = parg.fullVersionName;
  log.v( parg.newPdf + ' : Full Report Name : ' + parg.pdfReportName );
  log.v( parg.newPdf + ' : Full Version Name : ' + parg.pdfVersionName ); 

  log.d( 'Get Connection to query for any Default Mail configuration setup ' );

  oracledb.getConnection( credentials, function( err, dbc ) {

    if ( err ) {
      log.e( ' Unable to get Jde DB connection : ' + err );     
      return cbWhenDone( err );
    }  

    // Pull any PDFMAIL default configuration entries for the current PDF - there could be None, 1 or many entries
    // These will be used along with mailoptions defined at Report and/or Version level to determine mail settings for this Job
  
    sql = "SELECT crblkk, crtaskmisc  FROM " + jdeEnvDb.trim() + ".F559890 ";
    sql += parg.pdfReportName + " WHERE crpgm = 'PDFHANDLER' AND crvernm = 'PDFMAIL' AND crcfgsid = 'DEFAULT' ";
    sql += parg.pdfReportName + " ORDER BY CRBLKK, CRSEQ";
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

      rows = result.rows;
      rowCount = result.rows.length;

      if ( rowCount > 0 ) {
 
        parg.mailDefaultOptions = rows;
      
      } else {

        // No Mail Option Defaults Configured/Found
        parg.mailDefaultOptions = [];

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
