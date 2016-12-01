var nodemailer = require( 'nodemailer' ),
  async = require( 'async' ),
  log = require( './logger.js' ),
  smtpTransport,
  smtphost = process.env.MAIL_HOST,
  smtpport = process.env.MAIL_PORT,
  smtpuser = process.env.MAIL_USER,
  smtppwd = process.env.MAIL_PWD,
  jdeEnv = process.env.JDE_ENV,
  jdeEnvDb = process.env.JDE_ENV_DB;


smtpTransport = nodemailer.createTransport( "SMTP", {
  host: smtphost,
  port: smtpport,
  secure: true,		// use SSL
  auth: {
    user: smtpuser,
    pwd: smtppwd
  }
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
    substitute = {},
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
    //entry[ 1 ] = entry[ 1 ].trim();
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
    subject = '<!--ENVIRONMENT--> Dlink JDE Report <!--REPORT--> <!--VERSION--> <!--JOBNUMBER-->';
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
  substitute.report = pargs.fullReportName;  
  substitute.version = pargs.fullVersionName;  
  substitute.job = pargs.newPdf;  
  substitute.jobnumber = pargs.newPdf.split( '_' )[ 2 ];  
  substitute.env = jdeEnv.slice( 0, 2 );  
  substitute.environment = jdeEnv;  
  log.d( JSON.stringify( substitute ) );
  
  mo['from'] = from;
  mo['to'] = to;
  mo['subject'] = subjectPrefix +  subject + subjectPostfix;
  mo['html'] = textHeader + text + textFooter + textDisclaimer;

  // Subject and Text may contain substitution markers for PDF Report Name, Version, Job, Job Number and/or Environment
  // Check for any markers and replace with appropriate value
  mo['subject'] = mo['subject'].split( '<!--REPORT-->' ).join( substitute.report );
  mo['subject'] = mo['subject'].split( '<!--VERSION-->' ).join( substitute.version );
  mo['subject'] = mo['subject'].split( '<!--JOBNUMBER-->' ).join( substitute.jobnumber );
  mo['subject'] = mo['subject'].split( '<!--JOB-->' ).join( substitute.job );
  mo['subject'] = mo['subject'].split( '<!--ENV-->' ).join( substitute.env );
  mo['subject'] = mo['subject'].split( '<!--ENVIRONMENT-->' ).join( substitute.environment );

  mo['html'] = mo['html'].split( '<!--REPORT-->' ).join( substitute.report );
  mo['html'] = mo['html'].split( '<!--VERSION-->' ).join( substitute.version );
  mo['html'] = mo['html'].split( '<!--JOBNUMBER-->' ).join( substitute.jobnumber );
  mo['html'] = mo['html'].split( '<!--JOB-->' ).join( substitute.job );
  mo['html'] = mo['html'].split( '<!--ENV-->' ).join( substitute.env );
  mo['html'] = mo['html'].split( '<!--ENVIRONMENT-->' ).join( substitute.environment );

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


function cleanup() {

  // When finished with transport object do following....
  smtpTransport.close();

}
