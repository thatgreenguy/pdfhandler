// Module		: logoinfo.js
// Description		: Fetch PDFLOGO setup entries for current PDF entry
// Author		: Paul Green
// Dated		: 2015-11-19
//
// Checks PDFLOGO setup entries - if any - for current PDF being checked/processed
// If no entries then LOGO processing does not apply to this PDF 
// If 1 or 2 entries then extract Logo image to use and x,y coordinates for placement and signal LOGO processing shold be performed
// If more than 2 entries then setup is wrong and only first 2 setup entries will be considered


var oracledb = require( 'oracledb' ),
  async = require( './async' ),
  odb = require( './odb.js' ),
  log = require( './logger.js' );


// Functions -
//
//


// Takes a PDF name and splits it to Report and Version name adding them to parameters 
module.exports.checkPdflogoSetup = function( p, cbWhenDone ) {

  async.series([
    function( next ) { splitPdfName( p, next ) },
    function( next ) { fetchLogoSetup( p, next ) }
  ], function( err, res ) {

    if ( err ) {

      log.e( 'PDF ' + p.pdf + ' Failed fetching Logo Setup ' + err );
      log.e( 'PDF ' + p.pdf + err );

      return cbWhenDone;

    } else { 

      log.d( 'PDF ' + p.pdf + ' Fetched Logo Setup OK ' );
      log.d( 'PDF ' + p.pdf + res );

      return cbWhenDone;

    }

  });
}


// Takes a PDF name and splits it to Report and Version name adding them to parameters 
function splitPdfName = function( p, cb ) {

  var wka;

  wka = p.pdf.split("_");

  p.pdfReportName = wka[0];
  p.pdfVersionName = wka[1];

  log.d( 'Splitting PDF Name : ' + p.pdf );
  log.d( 'Splitting PDF Name : Report is : ' + p.pdfReportName );
  log.d( 'Splitting PDF Name : Version is : ' + p.pdfVersionName );

  return cb;  

}


// Takes a PDF name and splits it to Report and Version name adding them to parameters 
function fetchLogoSetup = function( p, cb ) {

  var query,
  binds = [],
  count;

  log.i( 'JDE PDF ' + record[ 0 ] + " - Lock established" );

  query = "SELECT crpgm, crvernm, crtaskmisc FROM jdeEnvDb.F559890 WHERE crpgm = '";
  query += p.pdfReportName + "'";

  log.d( 'PDF ' + p.pdf + ' : ' + query );

  p.dbc.execute( query, [], { }, function( err, rs ) {
        
  if ( err ) { 

    log.d( 'PDF ' + p.pdf + ' : Error unable to fetch PDFLOGO Setup records' );
    log.d( 'PDF ' + p.pdf + ' : ' + err.message );

    return cb( err );

  } else {

    count = rs.rows.length;

    log.d( 'PDF ' + p.pdf + ' : Found ' + count + ' PDFLOGO setup records' );

    // PDFLOGO setup records - there could be none, 1 or 2
    // If more than 2 just consider first 2 as only supposed to create a report level and/or version level entry
    // for Logo processing - Note: version setup overrides report setup

    if ( count > 0 ) {

      p.applyLogo = 'Y'

      if ( count == 1 ) {

        log.d( 'PDF ' + p.pdf + ' : One PDFLOGO setup entry found' );
        log.d( 'PDF ' + p.pdf + ' : Row 1 ' + rs.rows[ 0 ] );
        
        p.logoImage = '';
        p.logoX = 1;
        p.logoY = 1;

      } else {

        log.d( 'PDF ' + p.pdf + ' : Two PDFLOGO setup entries found' );
        log.d( 'PDF ' + p.pdf + ' : Row 1 ' + rs.rows[ 0 ] );
        log.d( 'PDF ' + p.pdf + ' : Row 2 ' + rs.rows[ 1 ] );


        p.logoImage = '';
        p.logoX = 1;
        p.logoY = 1;

      }

    } else { 

      log.d( 'PDF ' + p.pdf + ' : No PDFLOGO setup found' );

      p.applyLogo = 'N'
     
    }


    return cb( null );

  }
}
