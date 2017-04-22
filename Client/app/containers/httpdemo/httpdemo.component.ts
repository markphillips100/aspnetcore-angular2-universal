import { Component, Inject, OnInit, NgZone } from '@angular/core';
import { ActivatedRoute } from "@angular/router";
import { Http } from '@angular/http';
import { IUser } from '../../models/User';
import { ORIGIN_URL } from '../../shared/constants/baseurl.constants';
import { Observable } from 'rxjs/Observable';

import axios, { AxiosRequestConfig, AxiosPromise } from "axios";
import * as http from "http";

@Component({
    selector: 'httpdemo',
    templateUrl: './httpdemo.component.html',
  })
  export class HttpDemoComponent implements OnInit {

    private users: IUser[];

    private requestlib: string = "angular";

    constructor(private route: ActivatedRoute, private http: Http, @Inject(ORIGIN_URL) private baseUrl: string) {
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

    // Use Node http
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
