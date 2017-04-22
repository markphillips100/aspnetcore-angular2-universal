import { Component, Inject, OnInit, NgZone } from '@angular/core';
import { ActivatedRoute } from "@angular/router";
import { Http } from '@angular/http';
import { IUser } from '../../models/User';
import { ORIGIN_URL } from '../../shared/constants/baseurl.constants';
import { Observable } from 'rxjs/Observable';

import axios, { AxiosRequestConfig, AxiosPromise } from "axios";
import * as http from "http";
import * as https from "https";
import * as followRedirects from "follow-redirects";
let httpFollow = followRedirects.http;
let httpsFollow = followRedirects.https;
import settle from "axios/lib/core/settle";
import utils from "axios/lib/utils";
import createError from "axios/lib/core/createError";
import enhanceError from "axios/lib/core/enhanceError";
import * as url from "url";
import * as zlib from "zlib";
import * as BufferLib from "buffer";
let Buffer = BufferLib.Buffer;
import buildURL from "axios/lib/helpers/buildURL";

export function httpAdapter(config: AxiosRequestConfig): AxiosPromise {

  return new Promise(function dispatchHttpRequest(resolve, reject) {

    console.log("httpAdapter.  Setup promise");

    var data = config.data;
    var headers = config.headers;
    var timer;
    var aborted = false;

    // Set User-Agent (required by some servers)
    // Only set header if it hasn't been set in config
    // See https://github.com/mzabriskie/axios/issues/69
    if (!headers['User-Agent'] && !headers['user-agent']) {
      headers['User-Agent'] = 'axios'; // + pkg.version;
    }

    if (data && !utils.isStream(data)) {
      if (utils.isBuffer(data)) {
        // Nothing to do...
      } else if (utils.isArrayBuffer(data)) {
        data = new Buffer(new Uint8Array(data));
      } else if (utils.isString(data)) {
        data = new Buffer(data, 'utf-8');
      } else {
        return reject(createError(
          'Data after transformation must be a string, an ArrayBuffer, a Buffer, or a Stream',
          config
        ));
      }

      // Add Content-Length header if data exists
      headers['Content-Length'] = data.length;
    }

    // HTTP basic authentication
    var auth = undefined;
    if (config.auth) {
      var username = config.auth.username || '';
      var password = config.auth.password || '';
      auth = username + ':' + password;
    }

    // Parse url
    var parsed = url.parse(config.url);
    var protocol = parsed.protocol || 'http:';

    if (!auth && parsed.auth) {
      var urlAuth = parsed.auth.split(':');
      var urlUsername = urlAuth[0] || '';
      var urlPassword = urlAuth[1] || '';
      auth = urlUsername + ':' + urlPassword;
    }

    if (auth) {
      delete headers.Authorization;
    }

    var isHttps = protocol === 'https:';
    var agent = isHttps ? config.httpsAgent : config.httpAgent;

    var options: any = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: buildURL(parsed.path, config.params, config.paramsSerializer).replace(/^\?/, ''),
      method: config.method,
      headers: headers,
      agent: agent,
      auth: auth
    };

    var proxy: any = config.proxy;
    if (!proxy) {
      var proxyEnv = protocol.slice(0, -1) + '_proxy';
      var proxyUrl = process.env[proxyEnv] || process.env[proxyEnv.toUpperCase()];
      if (proxyUrl) {
        var parsedProxyUrl = url.parse(proxyUrl);
        proxy = {
          host: parsedProxyUrl.hostname,
          port: parsedProxyUrl.port
        };

        if (parsedProxyUrl.auth) {
          var proxyUrlAuth = parsedProxyUrl.auth.split(':');
          proxy.auth = {
            username: proxyUrlAuth[0],
            password: proxyUrlAuth[1]
          };
        }
      }
    }

    if (proxy) {
      options.hostname = proxy.host;
      options.host = proxy.host;
      options.headers.host = parsed.hostname + (parsed.port ? ':' + parsed.port : '');
      options.port = proxy.port;
      options.path = protocol + '//' + parsed.hostname + (parsed.port ? ':' + parsed.port : '') + options.path;

      // Basic proxy authorization
      if (proxy.auth) {
        var base64 = new Buffer(proxy.auth.username + ':' + proxy.auth.password, 'utf8').toString('base64');
        options.headers['Proxy-Authorization'] = 'Basic ' + base64;
      }
    }

    var transport;
    if (config.maxRedirects === 0) {
      transport = isHttps ? https : http;
    } else {
      if (config.maxRedirects) {
        options.maxRedirects = config.maxRedirects;
      }
      transport = isHttps ? httpsFollow : httpFollow;
    }

    // Create the request
    var req = transport.request(options,
      function handleResponse(res) {
        console.log("handleResponse");
        if (aborted) return;

        // Response has been received so kill timer that handles request timeout
        clearTimeout(timer);
        timer = null;

        // uncompress the response body transparently if required
        var stream = res;
        switch (res.headers['content-encoding']) {
          /*eslint default-case:0*/
        case 'gzip':
        case 'compress':
        case 'deflate':
          // add the unzipper to the body stream processing pipeline
          stream = stream.pipe(zlib.createUnzip());

          // remove the content-encoding in order to not confuse downstream operations
          delete res.headers['content-encoding'];
          break;
        }

        // return the last request in case of redirects
        var lastRequest = res.req || req;

        var response: any = {
          status: res.statusCode,
          statusText: res.statusMessage,
          headers: res.headers,
          config: config,
          request: lastRequest
        };

        if (config.responseType === 'stream') {
          response.data = stream;
          console.log("httpAdapter. stream response type. settle response.");
          settle(resolve, reject, response);
        } else {
          var responseBuffer = [];
          stream.on('data',
            function handleStreamData(chunk) {
              console.log("httpAdapter. on stream data.");

              responseBuffer.push(chunk);

              // make sure the content length is not over the maxContentLength if specified
              if (config.maxContentLength > -1 && Buffer.concat(responseBuffer).length > config.maxContentLength) {
                reject(createError('maxContentLength size of ' + config.maxContentLength + ' exceeded',
                  config,
                  null,
                  lastRequest));
              }
            });

          stream.on('error',
            function handleStreamError(err) {
              console.log("httpAdapter. on stream error.");
              if (aborted) return;
              reject(enhanceError(err, config, null, lastRequest));
            });

          stream.on('end',
            function handleStreamEnd() {
              var responseData = Buffer.concat(responseBuffer) as any;
              if (config.responseType !== 'arraybuffer') {
                responseData = responseData.toString('utf8');
              }

              response.data = responseData;
              console.log("httpAdapter. on stream end.  Settle response");

              settle(resolve, reject, response);
            });
        }
      });

    // Handle errors
    req.on('error', function handleRequestError(err) {
      console.log(err);
      if (aborted) return;
      reject(enhanceError(err, config, null, req));
    });

    // Handle request timeout
    if (config.timeout && !timer) {
      timer = setTimeout(function handleRequestTimeout() {
        req.abort();
        reject(createError('timeout of ' + config.timeout + 'ms exceeded', config, 'ECONNABORTED', req));
        aborted = true;
      }, config.timeout);
    }

    if (config.cancelToken) {
      // Handle cancellation
      config.cancelToken.promise.then(function onCanceled(cancel) {
        if (aborted) {
          return;
        }

        req.abort();
        reject(cancel);
        aborted = true;
      });
    }

    // Send the request
    if (utils.isStream(data)) {
      data.pipe(req);
    } else {
      req.end(data);
    }
  });
}

@Component({
    selector: 'httpdemo',
    templateUrl: './httpdemo.component.html',
  })
  export class HttpDemoComponent implements OnInit {

    private users: IUser[];

    private requestlib: string = "angular";

    constructor(private zone: NgZone, private route: ActivatedRoute, private http: Http, @Inject(ORIGIN_URL) private baseUrl: string) {
      axios.defaults.maxRedirects = 0;
      axios.defaults.adapter = httpAdapter;
    }

    ngOnInit() {
      this.requestlib = this.route.snapshot.data["requestlib"];

      this.getUsers().subscribe((result: IUser[]) => {
        console.log('Get user result: ', result);
        console.log('TransferHttp [GET] /api/users/allresult', result);
        this.users = result as IUser[];
      });
    }

    getUsers(): Observable<IUser[]> {
      const url = `${this.baseUrl}/api/users`;

      if (this.requestlib === "axios") {
        return this.fromPromise(axios.get(url)).map(res => res.data);
      } else if (this.requestlib === "angular") {
        return this.http.get(url).map(res => res.json());
      } else if (this.requestlib === "node") {
        return this.fromPromise(this.httpGet(url));
      }
    }

    private httpGet(url): Promise<IUser[]> {
      return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            const { statusCode } = res;
          if (statusCode !== 200) {
            reject(`Request failed.  Status code: ${statusCode}`);
          } else {
            res.setEncoding('utf8');
            let rawData = '';
            res.on('data', (chunk) => { rawData += chunk; });
            res.on('end',
              () => {

                try {
                  const parsedData = JSON.parse(rawData);
                  console.log(`Node http result: ${rawData}`);
                  resolve(parsedData);
                } catch (e) {
                  reject(e.message);
                }
              });
          }
        });
      });
    }

    private fromPromise<T>(promise: Promise<T>): Observable<T> {
      return Observable.fromPromise(Promise.resolve(promise));
    }
  }
