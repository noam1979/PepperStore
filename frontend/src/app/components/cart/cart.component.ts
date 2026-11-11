import { Component, ElementRef, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { Item } from 'src/app/models/item';
import { CartsService } from 'src/app/services/carts.service';
import { itemsService } from 'src/app/services/items.service';
import { ProductsService } from 'src/app/services/products.service';
import { UsersService } from 'src/app/services/users.service';
import { GlobalService } from 'src/app/services/global.service';

@Component({
  selector: 'app-cart',
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.css']
})
export class CartComponent {
  isAdmin = this.usersService.myUser ? this.usersService.myUser.role == 1 : false;
  total: number = 0;
  myCartContent: any[] = [];
  cartId: number;
  cartType: string;
  checkOut: boolean = false;
  searchProductName = "";
  @ViewChild('cartBody') cartBody: ElementRef;

  constructor(
    private router: Router,
    private productService: ProductsService,
    private cartsService: CartsService,
    private itemsService: itemsService,
    private usersService: UsersService,
    private globalService: GlobalService,
  ) {
    this.cartType = this.router.getCurrentNavigation()?.extras.state?.['cartStatus'];
  }

  /**
   * Calling 'getContent' function when the component load.
   * Listen to 'add items' event
   * Listen to 'search product' event in the receipt
   */
  ngOnInit(): void {
    if (this.cartType == "old") this.getContent();
    
    // Always load content on init to support guest localStorage cart as well
    this.getContent();

    this.itemsService.itemsEmitter.subscribe(() => {
      this.getContent();
    });
    
    this.productService.searchEmitter.subscribe((searchText) => {
      this.searchProductName = searchText;
    });
  }

  /**
   * Get cart content and calculate the total payment.
   * Supports both logged-in users (from server) and guests (from localStorage).
   */
  getContent() {
    if (this.usersService.myUser) {
      // Logged-in user: get cart content from server
      this.cartsService.getCartContent().subscribe({
        next: (value: any) => {
          this.myCartContent = value;
          this.total = 0;
          this.myCartContent.forEach((item: Item) => { this.total += item.totalPerProduct; });
          this.cartsService.cartTotal = this.total;
        },
        error: (err: any) => {
          err.status == '403'
            ? this.globalService.popThisMessage(err.error.message)
            : this.globalService.openSnackBar(err.error.message);
        }
      });
    } else {
      // Guest user: get cart content from localStorage
      this.myCartContent = JSON.parse(localStorage.getItem('guest_cart') || '[]');
      this.total = 0;
      this.myCartContent.forEach((item: Item) => { this.total += item.totalPerProduct; });
      this.cartsService.cartTotal = this.total;
    }
  }

  /**
   * Delete items from cart
   * @param deleteThis itemId(deletes specific item) or string "all"(delete all items)
   */
  DeleteItems(deleteThis: number | string) {
    this.searchProductName = "";
    
    if (this.usersService.myUser) {
      // Logged-in user: delete via server
      this.itemsService.deleteItems(deleteThis).subscribe({
        next: (value) => {},
        error: (err) => {
          err.status == '403'
            ? this.globalService.popThisMessage(err.error.message)
            : this.globalService.openSnackBar(err.error.message);
        }
      });
    } else {
      // Guest user: delete from localStorage
      if (deleteThis === 'all') {
        localStorage.removeItem('guest_cart');
        this.myCartContent = [];
        this.total = 0;
      } else {
        // delete specific item by productId or index
        let guestCart = JSON.parse(localStorage.getItem('guest_cart') || '[]');
        guestCart = guestCart.filter((item: Item) => item.productId !== deleteThis);
        localStorage.setItem('guest_cart', JSON.stringify(guestCart));
        this.myCartContent = guestCart;
      }
      this.total = 0;
      this.myCartContent.forEach((item: Item) => { this.total += item.totalPerProduct; });
      this.cartsService.cartTotal = this.total;
    }
  }

  /**
   * Display 'receipt mode' and navigate to 'orderDetails' component.
   */
  onCheckOut() {
    this.searchProductName = "";
    this.productService.clearEmitter.emit('check');
    if (this.myCartContent.length > 0) {
      this.productService.checkOut = true;
      this.checkOut = true;
      this.cartsService.cartCheckOut = true;
      if (this.cartBody) {
        this.cartBody.nativeElement.style.gridRow = 'span 10';
      }
      this.router.navigate([{ outlets: { primary: ['orderDetails'] } }]);
    }
  }

  /**
   * Moving back to 'cart mode'
   */
  goBack() {
    this.searchProductName = "";
    this.checkOut = false;
    this.productService.checkOut = false;
    this.productService.clearEmitter.emit('cart');
    this.cartsService.cartCheckOut = false;
    if (this.cartBody) {
      this.cartBody.nativeElement.style.gridRow = 'span 7';
    }
  }
}