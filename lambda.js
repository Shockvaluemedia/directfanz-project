const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

exports.handler = async (event, context) => {
  await app.prepare();
  
  const { path, httpMethod, headers, body, queryStringParameters } = event;
  
  const req = {
    method: httpMethod,
    url: path + (queryStringParameters ? '?' + new URLSearchParams(queryStringParameters).toString() : ''),
    headers: headers || {},
    body: body || ''
  };

  const res = {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader: function(name, value) { this.headers[name] = value; },
    writeHead: function(statusCode, headers) { 
      this.statusCode = statusCode; 
      Object.assign(this.headers, headers);
    },
    write: function(chunk) { this.body += chunk; },
    end: function(chunk) { if (chunk) this.body += chunk; }
  };

  await handle(req, res);
  
  return {
    statusCode: res.statusCode,
    headers: res.headers,
    body: res.body
  };
};