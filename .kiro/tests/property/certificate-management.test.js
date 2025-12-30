const https = require('https');

describe('Property Test: Certificate Management', () => {
  const domain = 'directfanz.io';

  it('validates wildcard certificate provisioning', (done) => {
    const options = {
      hostname: domain,
      port: 443,
      path: '/',
      method: 'GET'
    };

    const req = https.request(options, (res) => {
      const cert = res.socket.getPeerCertificate();
      if (!cert.subject) {
        return done(new Error('No certificate found'));
      }
      if (!cert.subjectaltname || !cert.subjectaltname.includes(`*.${domain}`)) {
        return done(new Error('Wildcard certificate not found'));
      }
      done();
    });

    req.on('error', done);
    req.end();
  });
});