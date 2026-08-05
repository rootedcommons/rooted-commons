# Welcome / email-confirmation template

Suggested subject:

**Welcome to Rooted Commons – confirm your email**

Suggested body:

> Hi {{ first_name }},
>
> Welcome to Rooted Commons. Your membership has been created successfully.
>
> Please confirm that this email address belongs to you by opening your secure member link:
>
> **[Confirm my email and open my dashboard]**
>
> This is a unique private link to your membership account and member credit. Please do not share it with anyone or use it on someone else's device.
>
> We will send you a new unique link each Wednesday after orders close. When a new link is issued, the previous one stops working.
>
> Your member number and payment reference is **{{ member_number }}**.
>
> Rooted Commons

Use the webhook payload's `link` (or `verificationLink`) for the confirmation button.

The signup endpoint also supplies `dashboardLink`, `member.firstName`, `member.lastName`, `member.memberNumber`, and the selected contribution frequency/amount.
