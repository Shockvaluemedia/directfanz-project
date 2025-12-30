const dns = require('dns').promises;

describe('Property Test: Subdomain Routing Accuracy', () => {
  const subdomains = ['api', 'ws', 'stream'];
  const domain = 'directfanz.io';

  it('validates all subdomains resolve correctly', async () => {
    for (const subdomain of subdomains) {
      const fqdn = `${subdomain}.${domain}`;
      const addresses = await dns.resolve4(fqdn);
      if (!addresses || addresses.length === 0) {
        throw new Error(`Subdomain ${fqdn} failed to resolve`);
      }
    }
  });
});