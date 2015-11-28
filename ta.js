var log = require( './common/logger.js' ),
  verConfig = [],
  rptConfig =[],
  mailOptions =[],  
  verrow,
  rptrow,
  versionOption,
  versionValue,
  reportOption,
  reportValue,
  index;


rptConfig = [['EMAIL', 'N'], ['EMAIL_TO', 'aaa@bbb.com'], ['EMAIL_TO', 'bbb@bbb.com'], ['SUBJECT', 'Test Report Lvl Subject']];
verConfig = [['EMAIL', 'Y'], ['EMAIL_TO', 'ccc@bbb.com'] ];

logValues( 'Before:', rptConfig, verConfig, mailOptions );

// Mailing Options will be a combination of Report Level Mailing Options
// merged with Version Level Mailing Options
//
// Check Report Options first
// If the Report option is not present in Version Options then add it to Mail Options
// as it has not been overridden

for ( var prop in rptConfig ) {

  if ( rptConfig.hasOwnProperty( prop )) {

    // Set option and value for current Report Mailing Option
    rptrow = rptConfig[ prop ];
    reportOption = rptrow[ 0 ];
    reportValue = rptrow[ 1 ];

    // Check to see if this Reort Option exists in Version Config
    index = findOption( reportOption, verConfig );

    if ( index > -1 ) {

      log.d( 'FOUND : Report Option replaced with Version Overrides Option ' );
      log.d( '      : Report Option : ' + rptrow );
      log.d( '      : Version Option : ' + verConfig[ index ] );

    } else {

      log.d( 'NOT FOUND : Report Option should be used as no Version Overrides Option ' );
      log.d( '          : Report Option : ' + rptrow );
      mailOptions.push( rptrow );

    };
  
  }
}

logValues( 'Intermediate:', rptConfig, verConfig, mailOptions );

// At this point mailOptions only holds email options from Report Config level where no version overrides exist
// Now need to add all version overrides 
var x = mailOptions.concat( verConfig );
mailOptions = x;

logValues( 'After:', rptConfig, verConfig, mailOptions );


// Provide mailing option to search for and a config array of mailing options to search
// Returns index of match or -1 if not found
function findOption( search, cfg ) {
 
  var i = 0;

  log.d( 'Searching for option : ' + search + ' in ' + cfg );       

  for ( var p in cfg ) {

    if ( cfg.hasOwnProperty( p )) {
        
        row = cfg[ p ];
        cfgOption = row[ 0 ];
        cfgValue  = row[ 1 ];
   
        if ( cfgOption === search ) {

          log.d( 'Match: Search Option found at : ' + i );
          return i;

        }       
        i += 1 ;    
      }
    }
  return -1;
}


// Provide mailing option to search for and a config array of mailing options to search
// Returns index of match or -1 if not found
function logValues( msg, rpt, ver, mail ) {

 log.d( '' );
 log.d( msg + ' ----------' );
 log.d( 'Report Options  : ' + rpt );
 log.d( 'Version Options : ' + ver );
 log.d( 'Mailing Options : ' + mail );
 log.d( '' );

}
