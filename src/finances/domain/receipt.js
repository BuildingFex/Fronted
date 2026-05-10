export class Receipt {
  constructor({ id = null, residentId, issueDate, dueDate, amount, status = 'Pending', lateFee = 0 }) {
    this.id = id;
    this.residentId = residentId;
    this.issueDate = issueDate;
    this.dueDate = dueDate;
    this.amount = amount;
    this.status = status; // 'Pending', 'Paid', 'Overdue'
    this.lateFee = lateFee;
  }

  isOverdue() {
    const today = new Date();
    const dueDate = new Date(this.dueDate);
    return this.status === 'Pending' && today > dueDate;
  }

  getTotalAmount() {
    return this.amount + this.lateFee;
  }
}
