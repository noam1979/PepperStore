import { AfterViewInit, Component, ElementRef, Input, OnInit, ViewChild } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { SubscriptSizing } from '@angular/material/form-field';
import { ActivatedRoute, Router } from '@angular/router';
import { Credentials } from 'src/app/models/credentials';
import User from 'src/app/models/user';
import { CartsService } from 'src/app/services/carts.service';
import { GlobalService } from 'src/app/services/global.service';
import { UsersService } from 'src/app/services/users.service';
import { environment } from 'src/environment/environment';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit, AfterViewInit {
  @Input() subscriptSizing: SubscriptSizing = 'dynamic';
  @ViewChild('shopBtn') shopBtn: MatButton;
  @ViewChild('warningsDiv') warningsDiv: ElementRef;

  shopBtnText = "Start Shopping";
  userLogin = new Credentials("noamnadav123@gmail.com", "Glorified@2026");
  isLogged = false;
  myUser: User;
  orderStatus: any;
  loginWarning: string;
  cartStatus: string;
  emailRegEx = environment.patterns.email;
  passwordRegEx = environment.patterns.password;

  constructor(
    private usersService: UsersService,
    private cartsService: CartsService,
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private globalService: GlobalService,
    private matDialog: MatDialog
  ) {
    // Retrieve navigation state data if coming from registration
    const myUserAfterRegister = this.router.getCurrentNavigation()?.extras.state?.['data'];
    this.myUser = myUserAfterRegister;
  }

  /**
   * After register - login will start immediately. If not - trigger automatic login with default credentials.
   */
ngOnInit() {
    if (this.myUser) {
      this.userLogin = new Credentials(this.myUser.username, this.myUser.password);
      this.onLogin();
    } else {
      // Do not auto-login on startup, allowing guests to browse freely without errors
    }
  }

  /**
   * Start auto login if there is a valid token in local storage.
   */
  autoLogin() {
    try {
      if (localStorage['userToken']) {
        const lastUserToken = localStorage['userToken'];
        this.usersService.isTokenValid(lastUserToken).subscribe({
          next: (value) => {
            if (value.message != "Invalid Token") {
              this.myUser = value;
              this.shopBtn._elementRef.nativeElement.disabled = false;
              if (this.myUser.role == 0)
                this.raiseStatusEmitter();
              else
                this.shopBtnText = "Add/Edit Products";
            }
          },
          error: (err) => {
            this.globalService.popThisMessage(err.error.message);
          }
        });
      }
    } catch (err: any) {
      this.globalService.openSnackBar('Oops, Something went wrong! Try Again!');
    }
  }

  /**
   * Keep the shop button enabled by default so guests can click it without logging in.
   */
  ngAfterViewInit() {
    // Leave shop button enabled for guests
    // this.shopBtn._elementRef.nativeElement.disabled = true;
  }

  /**
   * Display registration form step 1
   */
  goRegister() {
    this.router.navigate([{ outlets: { leftBar: 'registerA' } }]);
  }

  /**
   * Start login process
   */
  onLogin() {
    if (this.warningsDiv) this.warningsDiv.nativeElement.innerHTML = "";
    this.usersService.isLogged(this.userLogin)
      .subscribe({
        next: (value: any) => {
          this.myUser = value;
          this.isLogged = true;
          localStorage["userToken"] = value.token;

          if (this.myUser.role == 0) {
            this.shopBtn._elementRef.nativeElement.disabled = false;
            this.raiseStatusEmitter();
          } else {
            this.router.navigate([{ outlets: { primary: 'products', leftBar: 'cart' } }]);
          }
        },
        error: (err) => {
          this.isLogged = false;
          this.shopBtnText = "Start Shopping";
          this.shopBtn._elementRef.nativeElement.disabled = false; // Allow guest clicking even if login fails
          const errors = err.error.message;
          err.status == '403'
            ? this.globalService.popThisMessage(errors)
            : this.globalService.openSnackBar(JSON.stringify(errors, null, " "));

          if (typeof errors == 'object') {
            for (const key in errors) {
              this.warningsDiv.nativeElement.innerHTML += (`<span class="bi bi-exclamation-circle-fill"> ${errors[key]}</span><br/>`);
            }
          } else {
            this.warningsDiv.nativeElement.innerHTML = `<span class="bi bi-exclamation-circle-fill"> ${errors}</span>`;
          }
        }
      });
  }

  /**
   * Check if the user has an open cart.
   */
  raiseStatusEmitter() {
    this.cartsService.getStatus(this.myUser.userId, this.myUser.firstName).subscribe({
      next: (value) => {
        if (value.resType == 1) {
          this.shopBtnText = "Resume Shopping";
          this.cartStatus = "old";
        } else {
          this.shopBtnText = "Start Shopping";
          this.cartStatus = "new";
        }
      },
      error: (error) => {
        this.globalService.popThisMessage(error.err.message);
      }
    });
  }

  /**
   * Navigate to cart and products component.
   * Allows unauthenticated guests to navigate straight to shopping.
   */
  goShop() {
    try {
      // Allow guests to go straight to shopping if not logged in
      if (!this.myUser) {
        this.router.navigate([{ outlets: { leftBar: ['cart'], primary: ['products'] } }]);
        return;
      }

      if (this.myUser.role == 1) {
        this.router.navigate([{ outlets: { leftBar: ['cart'], primary: ['products'] } }]);
      } else if (this.cartStatus == "new") {
        this.cartsService.openNewCart(this.myUser.userId).subscribe({
          next: (value) => {
            this.router.navigate([{ outlets: { leftBar: ['cart'], primary: ['products'] } }], { state: { cartStatus: this.cartStatus } });
          },
          error: (err) => {
            err.status == '403'
              ? this.globalService.popThisMessage(err.error.message)
              : this.globalService.openSnackBar(JSON.stringify(err.error.message));
          }
        });
      } else if (this.cartStatus == "old") {
        this.router.navigate([{ outlets: { leftBar: ['cart'], primary: ['products'] } }], { state: { cartStatus: this.cartStatus } });
      }
    } catch (err) {
      this.shopBtn._elementRef.nativeElement.disabled = true;
      this.globalService.openSnackBar("Oops something went wrong!");
    }
  }
}