var nodemailer = require( 'nodemailer' ),
  async = require( 'async' ),
  log = require( './logger.js' ),
  smtpTransport,
  smtphost = process.env.MAIL_HOST,
  smtpport = process.env.MAIL_PORT,
  jdeEnv = process.env.JDE_ENV,
  jdeEnvDb = process.env.JDE_ENV_DB;


smtpTransport = nodemailer.createTransport( "SMTP", {
  host: smtphost,
  port: smtpport
});



// mailOptions holds mail configuration for this report from the JDE database
// this could be as simple as a TO address as sensible defaults should be provided
// by this program for any missing config.
// In order to send an email the minimum required is an EMAIL = 'Y' and a TO address
// following default values will be supplied for rest
//
module.exports.sendEmail = function( pargs, postMailCb ) {

  var email,
    from = '',
    substitutionValues = {},
    to = '',
    subject = '',
    subjectPrefix = '',
    subjectPostfix = '',
    cc = '', 
    bcc = '',
    textHeader = '',
    text = '',
    textDisclaimer = '',
    textFooter = '',
    attachments = [],
    wrk = {},
    entry,
    mo = {},
    csv = 'N',
    textCount = 0,
    textHeaderCount,
    textCount,
    textDisclaimerCount,
    textFooterCount;

  jdeJob = pargs.newPdf;

  // STAGE 1
  // 
  // Consider the PDFHANDLER / PDFMAIL Application Level DEFAULT Options

  // Loop through whatever application level defaults are available and set Subject, Text related default values
  // according to configuration/setup found for the PDFHANDLER application under PDFMAIL and DEFAULT
  for ( var i = 0; i < pargs.mailDefaultOptions.length; i++ ) {

    entry = pargs.mailDefaultOptions[ i ];
    entry[ 0 ] = entry[ 0 ].trim();
    entry[ 1 ] = entry[ 1 ].trim();
    log.v( entry );

    if ( entry[ 0 ] === 'EMAIL_FROM' ) {
      from = entry[ 1 ];
    }

    if ( entry[ 0 ] === 'EMAIL_SUBJECT' ) {
      subject = entry[ 1 ];
    }

    if ( entry[ 0 ] === 'EMAIL_SUBJECT_PREFIX' ) {
      subjectPrefix = entry[ 1 ];
    }

    if ( entry[ 0 ] === 'EMAIL_SUBJECT_POSTFIX' ) {
      subjectPostfix = entry[ 1 ];
    }

    if ( entry[ 0 ] === 'EMAIL_TEXT_HEADER' ) {

      if ( textHeaderCount == 0 ) {

        textHeader = entry[ 1 ];

      } else {

        textHeader += entry[ 1 ]; 

      }
      textHeaderCount += 1;        
    }

    if ( entry[ 0 ] === 'EMAIL_TEXT' ) {

      if ( textCount == 0 ) {

        text = entry[ 1 ];

      } else {

        text += entry[ 1 ]; 

      }
      textCount += 1;        
    }

    if ( entry[ 0 ] === 'EMAIL_TEXT_DISCLAIMER' ) {

      if ( textDisclaimerCount == 0 ) {

        textDisclaimer = entry[ 1 ];

      } else {

        textDisclaimer += entry[ 1 ]; 

      }
      textDisclaimerCount += 1;        
    }

    if ( entry[ 0 ] === 'EMAIL_TEXT_FOOTER' ) {

      if ( textFooterCount == 0 ) {

        textFooter = entry[ 1 ];

      } else {

        textFooter += entry[ 1 ]; 

      }
      textFooterCount += 1;        
    }

  }

  // If no Default configuration setup yet exists for Subject and/or Text then fallback to some sane hard coded textual defaults
  // Until someone completes the application level defaults for these important items. Note these will only be used if no
  // Report / Version specific configuration exists!
  //
  // Application Level DEFAULT FROM Value
  // 
  if ( typeof( from ) != 'undefined' && from.length > 0 ) {
    // Something is in DEFAULT FROM so don't apply last resort default value!
  } else {
    from = 'noreply@dlink.eu';
  }

  //
  // Application Level DEFAULT SUBJECT Value
  // 
  if ( typeof( subject ) != 'undefined' && subject.length > 0 ) {
    // Something is in Subject so don't apply last resort default value!
  } else {
    subject = 'Dlink JDE Report $JOB';
  }

  //
  // Application Level DEFAULT TEXT Value
  // 
  if ( typeof( text ) != 'undefined' && text.length > 0 ) {
    // Something is in Text so don't apply last resort default value!
  } else { 
    text = 'This is an automated email delivery of a report from the Dlink JDE ERP system. Please see attached report.';
  }

  log.v( pargs.newPdf + ' DEFAULT FROM: ' + from );
  log.v( pargs.newPdf + ' DEFAULT SUBJECT PREFIX: ' + subjectPrefix );
  log.v( pargs.newPdf + ' DEFAULT SUBJECT: ' + subject );
  log.v( pargs.newPdf + ' DEFAULT SUBJECT POSTFIX: ' + subjectPostfix );
  log.v( pargs.newPdf + ' DEFAULT TEXT HEADER:    ' + textHeader );
  log.v( pargs.newPdf + ' DEFAULT TEXT:    ' + text );
  log.v( pargs.newPdf + ' DEFAULT TEXT DISCLAIMER:    ' + textDisclaimer );
  log.v( pargs.newPdf + ' DEFAULT TEXT FOOTER:    ' + textFooter );


  // STAGE 2
  // 
  // Now consider the Report / Version Mailing Options which can overwrite any Application Level Defaults
  //
  textHeaderCount = 0;
  textCount = 0;
  textDisclaimerCount = 0;
  textFooterCount= 0;
  mailOptions = pargs.mailOptionsArray;

  // Next set mailing options according to whatever was configured for the Report/Version
  // Note if Subject/Text options exist here they will overwrite anything configured at the application level
  // Build up all mailing options for this JDE PDF Job/Report
  for ( var i = 0; i < mailOptions.length; i++ ) {

    entry = mailOptions[ i ];
    log.v( entry );

    if ( entry[ 0 ] === 'EMAIL' ) {
      email = entry[ 1 ];
    }

    if ( entry[ 0 ] === 'EMAIL_FROM' ) {
      from = entry[ 1 ];
    }

    if ( entry[ 0 ] === 'EMAIL_TO' ) {
      if ( to ) {
        to += ', ' + entry[ 1 ];
      } else {
        to = entry[ 1 ];
      }
    }

    if ( entry[ 0 ] === 'EMAIL_CC' ) {
      if ( cc ) {
        cc += ', ' + entry[ 1 ];
      } else {
        cc = entry[ 1 ];
      }
    }

    if ( entry[ 0 ] === 'EMAIL_BCC' ) {
      if ( bcc ) {
        bcc += ', ' + entry[ 1 ];
      } else {
        bcc = entry[ 1 ];
      }
    }

    if ( entry[ 0 ] === 'EMAIL_CSV' ) {
      csv = entry[ 1 ];
    }

    if ( entry[ 0 ] === 'EMAIL_SUBJECT' ) {
      subject = entry[ 1 ];
    }

    if ( entry[ 0 ] === 'EMAIL_SUBJECT_PREFIX' ) {
      subjectPrefix = entry[ 1 ];
    }

    if ( entry[ 0 ] === 'EMAIL_SUBJECT_POSTFIX' ) {
      subjectPostfix = entry[ 1 ];
    }

    if ( entry[ 0 ] === 'EMAIL_TEXT_HEADER' ) {

      if ( textHeaderCount == 0 ) {

        textHeader = entry[ 1 ];

      } else {

        textHeader += entry[ 1 ]; 

      }
      textHeaderCount += 1;        
    }

    if ( entry[ 0 ] === 'EMAIL_TEXT' ) {

      if ( textCount == 0 ) {

        text = entry[ 1 ];

      } else {

        text += entry[ 1 ]; 

      }
      textCount += 1;        
    }

    if ( entry[ 0 ] === 'EMAIL_TEXT_DISCLAIMER' ) {

      if ( textDisclaimerCount == 0 ) {

        textDisclaimer = entry[ 1 ];

      } else {

        textDisclaimer += entry[ 1 ]; 

      }
      textDisclaimerCount += 1;        
    }

    if ( entry[ 0 ] === 'EMAIL_TEXT_FOOTER' ) {

      if ( textFooterCount == 0 ) {

        textFooter = entry[ 1 ];

      } else {

        textFooter += entry[ 1 ]; 

      }
      textFooterCount += 1;        
    }

  }


  // Could be sending .pdf or .csv
  if ( csv !== 'Y' ) {
    wrk[ 'filename' ] = jdeJob.trim() + '.pdf';
    wrk[ 'filePath' ] = '/home/shareddata/wrkdir/' + jdeJob.trim() + '.pdf';
  } else {
    wrk[ 'filename' ] = jdeJob.trim() + '.csv';
    wrk[ 'filePath' ] = '/home/shareddata/wrkdir/' + jdeJob.trim() + '.csv';
  }

  attachments[ 0 ] = wrk;

  if ( ! to ) {
 
    log.w( pargs.newPdf + ' No TO recipient defined - unable to send this email' );
    mailOptions.mailenabled = 'N';
    email = 'N';
    return postMailCb( null );

  }

  log.i( pargs.newPdf + ' EMAIL: ' + email );
  log.i( pargs.newPdf + ' FROM: ' + from );
  log.i( pargs.newPdf + ' TO: ' + to );
  log.i( pargs.newPdf + ' SUBJECT: ' + subject );
  log.i( pargs.newPdf + ' SUBJECT PREFIX: ' + subject );
  log.i( pargs.newPdf + ' SUBJECT POSTFIX: ' + subject );
  log.i( pargs.newPdf + ' CC: ' + cc );
  log.i( pargs.newPdf + ' BCC: ' + bcc );
  log.i( pargs.newPdf + ' TEXT HEADER: ' + textHeader );
  log.i( pargs.newPdf + ' TEXT: ' + text );
  log.i( pargs.newPdf + ' TEXT DISCLAIMER: ' + textDisclaimer );
  log.i( pargs.newPdf + ' TEXT FOOTER: ' + textFooter );
  log.i( pargs.newPdf + ' ATT: ' + attachments );


  // Application Level Mailing Options have been considered, Report/Version Level options have been considered
  // So finally set the actual mailing options we need to use when sending this Report / Version
  // mo['text'] = constructEmailText( text );
  //
  substitutionValues = setSubstitutionValues{ pargs };
  
  mo['from'] = from;
  mo['to'] = to;
  mo['subject'] = constructEmailSubject( subjectPrefix, subject, subjectPostfix, substitutionValues );
  mo['html'] = constructEmailText( textHeader, text, textFooter, textDisclaimer, substitutionValues );
  if ( cc ) {
    mo['cc'] = cc;
  }
  if ( bcc ) {
    mo['bcc'] = bcc;
  }
  mo['attachments'] = attachments;

  log.v( JSON.stringify( mo ) );

  // Now send the email with Report attachment
  if ( email === 'Y' ) {
    smtpTransport.sendMail( mo, 
    function(err, response) {
  
      if ( err ) {
        response = 'EMAIL Send FAILED : ' + err
        log.e( response );
        return postMailCb( err, response );

      } else {
        response = 'EMAIL Sent OK : ' + JSON.stringify( response );
        log.i( response );
        postMailCb( null, response);
      }
    });
  } 
}


// JDE Oneworld PDF Reports are identified by Report Name, Version Name, Job Number and a mix of these values known as Job id
// These four values are available to be used in EMAIL_SUBJECT and EMAIL_TEXT
// If the special substitution markers REPORT, VERSION, JOBNUMBER and/or JOB are found embedded in Subject/Text contained in HTML comments <-- -->
// Then they are switched with the actual PDF values
// This function makes these values available for each PDF
//
function setSubstitutionValues( pargs ) {

  var result = {},
    wka = null;

  result.report = pargs.fullReportName;  
  result.version = pargs.fullVersionName;  
  result.job = pargs.newPdf;
  wka = result.job.split( '_' );
  result.jobnumber = wka[ 2 ];

  log.d( JSON.stringify( result ) );

  return result;
}


// Email Subject is constituted from a Prefix, subject text and a postfix
// These subject parts may contain substitution markers for PDF Report Name, Version, Job and/or Job Number
//
function constructEmailSubject( prefix, text, postfix, subval ) {

  var result = '';

  result = prefix + text + postfix;
  return checkReplaceMarkers( result, subval );

}


// Email Text is constituted from Header, Text, Footer and/or Disclaimer sections
// These sub-sections may contain substitution markers for PDF Report Name, Version, Job and/or Job Number
//
function constructEmailText( header, text, footer, disclaimer, subval ) {

  var result = '';

  result = header + text + footer + disclaimer;
  return checkReplaceMarkers( result, subval );
 
}


// Check for substitution markers and replace with required PDF attributes values
function checkReplaceMarkers( text ) {

  var result;

  result = text;
  log.d( 'chkrep:::' + result );
  result = result.split( '<!--REPORT-->' ).join( subval.report );
  log.d( 'chkrep:::' + result );
  result = result.split( '<!--VERSION-->' ).join( subval.version );
  log.d( 'chkrep:::' + result );
  result = result.split( '<!--JOBNUMBER-->' ).join( subval.jobnumber );
  log.d( 'chkrep:::' + result );
  result = result.split( '<!--JOB-->' ).join( subval.job );
  log.d( 'chkrep:::' + result );

}


function cleanup() {

  // When finished with transport object do following....
  smtpTransport.close();

}
