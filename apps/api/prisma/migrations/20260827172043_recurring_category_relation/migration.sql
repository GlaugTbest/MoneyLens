-- AddForeignKey
ALTER TABLE "RecurringExpenseGroup" ADD CONSTRAINT "RecurringExpenseGroup_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
