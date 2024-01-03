const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
var cors = require("cors");
var _ = require("lodash");
require("dotenv").config();

const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(cors()); //enable Access-Control-Origin from all sources using cors package

const port = process.env.port || 5000;

main().catch((err) => console.log(err));

async function main() {
  await mongoose.connect(process.env.REACT_APP_MONGODBURL);
}

//create a schema for user data to be stored. Their products, cart data, orders and orderReceived are also stored as arrays using this schema.

const userdataSchema = new mongoose.Schema({
  uid: String,
  email: String,
  fname: String,
  lname: String,
  phoneNumber: String,
  accountType: String,
  cart: Array,
  orders: Array,
  products: Array,
  ordersReceived: Array,
});

const userDatas = mongoose.model("userdatas", userdataSchema);

//all API calls are self explanatory with additional explanation inside the request on a case by case basis.

app.post("/api/signup", (req, res) => {
  let userDataObj = new userDatas({
    uid: req.body.uid,
    email: req.body.email.toLowerCase(),
    fname: req.body.fname,
    lname: req.body.lname,
    phoneNumber: req.body.phoneNumber,
    accountType: req.body.accountType,
    cart: [],
    orders: [],
    products: [],
    ordersReceived: [],
  });

  //console.log(userDataObj);

  userDataObj.save();
});

app.post("/api/addproduct", (req, res) => {
  let uid = req.body.uid;

  let productData = {
    name: req.body.name,
    price: req.body.price,
    description: req.body.description,
    id: req.body.id,
    productPicUrl: req.body.productPicUrl,
  };

  userDatas
    .findOneAndUpdate({ uid: uid }, { $push: { products: productData } })
    .then(console.log("updated products array"));

  //console.log(productData, uid);
});

app.get("/api/userdetails", (req, res) => {
  let user = req.query.user;
  userDatas.find({ uid: user }).then((docs) => {
    res.send(docs);
  });
});

app.get("/api/myproducts", (req, res) => {
  let userId = req.query.user;
  userDatas.find({ uid: userId }).then((docs) => {
    res.send(docs[0].products);
  });
});

app.get("/api/productlist", (req, res) => {
  userDatas.find({ accountType: "Seller" }).then((docs) => {
    res.send(docs);
  });
});

app.get("/api/cartdetails", (req, res) => {
  let user = req.query.user;
  userDatas.find({ uid: user }).then((docs) => {
    res.send(docs[0].cart);
  });
});

app.get("/api/ordersdetails", (req, res) => {
  let user = req.query.user;
  userDatas.find({ uid: user }).then((docs) => {
    res.send(docs[0].ordersReceived);
  });
});

app.get("/api/myordersdetails", (req, res) => {
  let user = req.query.user;
  userDatas.find({ uid: user }).then((docs) => {
    res.send(docs[0].orders);
  });
});

app.put("/api/deleteproduct", (req, res) => {
  let uid = req.body.uid;
  let itemId = req.body.itemId;

  userDatas
    .findOneAndUpdate({ uid: uid }, { $pull: { products: { id: itemId } } })
    .then((docs) => console.log("deleted product"));
});

app.put("/api/addtocart", (req, res) => {
  let sellerName = req.body.sellerName;
  let sellerUid = req.body.sellerUid;

  let product = req.body.product;
  product.sellerName = sellerName;
  product.sellerUid = sellerUid;

  let uid = req.body.uid;

  userDatas.findOne({ uid: uid }).then((docs) => {
    //console.log(docs.cart);
    //console.log(product);

    //if cart already has product, the product is not added again, because the quantity of product can be edited in the cart view of the dashboard.
    if (docs.cart.some((item) => item.id === product.id)) {
      console.log("cart has product");
    } else {
      userDatas
        .findOneAndUpdate({ uid: uid }, { $push: { cart: product } })
        .then((docs) => {
          console.log("added product to cart");
          res.send(docs);
        });
    }
  });
});

app.put("/api/deletefromcart", (req, res) => {
  let uid = req.body.uid;
  let itemId = req.body.itemId;

  //console.log(uid, itemId);

  userDatas
    .findOneAndUpdate({ uid: uid }, { $pull: { cart: { id: itemId } } })
    .then((docs) => {
      console.log("product removed from cart");
      res.send(docs);
    });
});

app.put("/api/placeorder", (req, res) => {
  let uid = req.body.uid;
  let cartData = req.body.cartData;
  let orderedByName = req.body.orderedByName;
  let orderedByContact = req.body.orderedByContact;
  let id = Date.now().toString(36);
  let date = new Date();

  //when the order is placed, the buyer and seller databased are updated with the product accordingly. Buyer data is stored in "orders" array and seller data is stored in "ordersReceived" array.

  userDatas.find({ accountType: "Seller" }).then((docs) => {
    //console.log(docs);
    docs.forEach((docItem) => {
      cartData.forEach((cartItem) => {
        //cartData is sorted as per the seller whose product is ordered, identified by the sellerUid vairable. the docItem.uid variable is compared to sellerUid to see if that product belongs to the seller.

        if (docItem.uid === cartItem.sellerUid) {
          userDatas
            .findOneAndUpdate(
              { uid: docItem.uid },
              {
                $push: {
                  ordersReceived: {
                    id: id,
                    date: date,
                    orderedBy: uid,
                    orderedByName: orderedByName,
                    orderedByContact: orderedByContact,
                    fulfilled: false,
                    cartItem,
                  },
                },
              }
            )
            .then(console.log("sent order to seller"));
        }
      });
    });
  });

  //console.log("order placed!", uid, cartData);

  userDatas
    .findOneAndUpdate(
      { uid: uid },
      { $push: { orders: { id: id, date: date, cartData } } }
    )
    .then(
      userDatas.findOneAndUpdate({ uid: uid }, { cart: [] }).then((docs) => {
        console.log("order placed and cart emptied");
        res.send(docs);
      })
    );
});

app.put("/api/fulfillorder", (req, res) => {
  //when the order is fulfilled on the seller side, the order is marked as "completed" on the buyers side by setting the item.fulfilled flag as true in the database.
  let uid = req.body.uid;
  let itemId = req.body.itemId;
  let orderId = req.body.orderId;
  let orderedBy = req.body.orderedBy;
  //console.log(uid, itemId, orderId, orderedBy);

  userDatas.findOne({ uid: uid }).then((docs) => {
    docs.ordersReceived.forEach((item) => {
      if (item.id === orderId && item.cartItem.id === itemId) {
        item.fulfilled = true;
      }
    });

    userDatas
      .findOneAndUpdate({ uid: uid }, docs, { new: true })
      .then((docs) => {
        console.log("order fulfilled on seller side"); // the sellers orderReceived array is updated with order fulfilled tag.
      });
  });

  userDatas.findOne({ uid: orderedBy }).then((docs) => {
    docs.orders.forEach((item) => {
      if (item.id === orderId) {
        item.cartData.forEach((item) => {
          if (item.id === itemId) {
            item.fulfilled = true;
          }
        });
      }
    });
    //console.log(docs);
    userDatas
      .findOneAndUpdate({ uid: orderedBy }, docs)
      .then(console.log("order fulfilled on buyer side")); //the buyer has the order array fulfilled tag as true in his/her database as well.
  });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
