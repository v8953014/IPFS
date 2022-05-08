import { HttpErrorResponse } from "@angular/common/http"
import type { OnDestroy, OnInit } from "@angular/core"
import { ChangeDetectionStrategy, Component, EventEmitter, Inject, ViewChild } from "@angular/core"
import type { ThemePalette } from "@angular/material/core"
import { MatTable, MatTableDataSource } from "@angular/material/table"
import type { Subscription } from "rxjs"
import { takeUntil } from "rxjs/operators"
import { environment } from "../../environments/environment"
import { Protocol } from "../enums/protocol.enum"
import { Theme } from "../enums/theme.enum"
import { GatewayService } from "../services/gateway.service"
import { ThemeService } from "../services/theme.service"

@Component({
  selector: "app-pages",
  templateUrl: "./pages.component.html",
  styleUrls: ["./pages.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PagesComponent implements OnInit, OnDestroy {
  @ViewChild(MatTable) matTable!: MatTable<Result>

  gateways!: string[]
  inputColour: ThemePalette = "primary"
  ipfs = ""
  ipns = ""

  readonly dataSource = new MatTableDataSource<Result>([])
  readonly displayedColumns = ["icon", "gateway"]
  readonly subscriptions: Subscription[] = []

  private readonly destroy$ = new EventEmitter<void>()

  constructor(
    @Inject(GatewayService) private readonly gatewayService: GatewayService,
    @Inject(ThemeService) private readonly themeService: ThemeService
  ) {}

  ngOnInit(): void {
    this.gatewayService
      .list()
      .pipe(takeUntil(this.destroy$))
      .subscribe((gateways): void => {
        this.gateways = gateways
      })

    // Theme
    this.setColours(this.themeService.current)
    this.themeService.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((theme): void => {
      this.setColours(theme)
    })
  }

  ngOnDestroy(): void {
    this.destroy$.next()
    this.destroy$.complete()
  }

  cacheIPFS(): void {
    this.ipfs = this.ipfs.trim()
    this.cache(Protocol.IPFS, this.ipfs)
  }

  cacheIPNS(): void {
    this.ipns = this.ipns.trim()
    this.cache(Protocol.IPNS, this.ipns)
  }

  cache(protocol: Protocol, hashpath: string): void {
    // Clear subscriptions
    while (this.subscriptions.length) {
      const sub = this.subscriptions.pop()
      if (sub && !sub.closed) {
        sub.unsubscribe()
      }
    }

    // Clear table
    this.dataSource.data = []
    this.matTable.renderRows()
    console.clear()

    this.gateways.forEach((gateway): void => {
      this.subscriptions.push(
        this.gatewayService
          .get(gateway, protocol, hashpath)
          .pipe(takeUntil(this.destroy$))
          .subscribe(
            (resp): void => {
              this.dataSource.data.unshift({
                gateway: this.gatewayService.url(gateway, protocol, hashpath),
                message: resp.statusText,
                icon: this.getIcon(resp.status),
                ok: resp.ok,
              })
              this.matTable.renderRows()
            },
            (error: unknown): void => {
              if (!(error instanceof HttpErrorResponse)) return

              this.dataSource.data.push({
                gateway: this.gatewayService.url(gateway, protocol, hashpath),
                message: error.statusText,
                icon: this.getIcon(error.status),
                ok: error.ok,
              })
              this.matTable.renderRows()
            }
          )
      )
    })
  }

  private setColours(theme: Theme): void {
    switch (theme) {
      case Theme.Light:
        this.inputColour = "primary"
        break
      case Theme.Dark:
        this.inputColour = "accent"
        break
      default:
        break
    }
  }

  private getIcon(status: number): string {
    if (status >= 200 && status < 300) {
      return "✅"
    }
    switch (status) {
      case 0:
        return "❌"
      case 403:
        return "⛔"
      case 404:
        return "❓"
      case 500:
        return "❗"
      default:
        return environment.production ? "❌" : "❔"
    }
  }
}

interface Result {
  gateway: string
  message: string
  icon: string
  ok: boolean
}
