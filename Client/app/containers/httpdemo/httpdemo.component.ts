import { Component, Inject, OnInit } from '@angular/core';
import { ActivatedRoute } from "@angular/router";
import { Http } from '@angular/http';
import { IUser } from '../../models/User';
import { ORIGIN_URL } from '../../shared/constants/baseurl.constants';
import { Observable } from 'rxjs/Observable';

import axios from "axios";

@Component({
  selector: 'httpdemo',
  templateUrl: './httpdemo.component.html',
})
export class HttpDemoComponent implements OnInit {

  private users: IUser[];

  private requestlib: string = "angular";

  constructor(private route: ActivatedRoute, private http: Http, @Inject(ORIGIN_URL) private baseUrl: string) { }

  ngOnInit() {
    this.requestlib = this.route.snapshot.data["requestlib"];

    this.getUsers().subscribe((result: IUser[]) => {
      console.log('Get user result: ', result);
      console.log('TransferHttp [GET] /api/users/allresult', result);
      this.users = result as IUser[];
    });
  }

  getUsers(): Observable<IUser[]> {
    if (this.requestlib === "axios") {
      return this.fromPromise(axios.get(`${this.baseUrl}/api/users`)).map(res => res.data);
    } else if (this.requestlib === "angular") {
      return this.http.get(`${this.baseUrl}/api/users`).map(res => res.json());
    }
  }

  private fromPromise<T>(promise: Promise<T>): Observable<T> {
    return Observable.fromPromise(Promise.resolve(promise));
  }
}
