const mongoose = require("mongoose");

const callbackLogSchema = new mongoose.Schema(
  {
    invoiceToken: { type: String },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    rawStatus: { type: String },
    data: { type: mongoose.Schema.Types.Mixed },
    processed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CallbackLog", callbackLogSchema);
