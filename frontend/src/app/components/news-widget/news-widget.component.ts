import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, timer } from 'rxjs';
import { catchError, map, shareReplay, switchMap } from 'rxjs/operators';

export interface NewsRelease {
  date: string;      // YYYY-MM-DD
  headline: string;
  url: string;       // official investor-relations page
}

/**
 * Latest official company releases, served by the self-hosted services helper
 * at /api/v1/services/news (mirrored from the company website's news export).
 * Headlines are rendered as text only; links open the investor-relations site.
 */
@Component({
  selector: 'app-news-widget',
  templateUrl: './news-widget.component.html',
  styleUrls: ['./news-widget.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewsWidgetComponent implements OnInit {
  @Input() limit = 5;

  releases$: Observable<NewsRelease[]>;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    // Refresh every 15 minutes while the page is open.
    this.releases$ = timer(0, 15 * 60 * 1000).pipe(
      switchMap(() => this.http.get<{ releases: NewsRelease[] }>('/api/v1/services/news').pipe(
        map(res => (res?.releases || []).slice(0, this.limit)),
        catchError(() => of([])),
      )),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }
}
