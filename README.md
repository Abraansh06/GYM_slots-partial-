--> A web application that manages hourly gym sessions with a strict 20-seat limit, automated waitlists, and door check-ins.
The application is built with Node.js, Express, and SQLite (better-sqlite3) on the backend, paired with a clean vanilla HTML, CSS frontend.
User authentication and role-based access control are handled via JSON Web Tokens (JWT) and bcryptjs for secure password hashing.
The database schema uses four relational tables (users, sessions, bookings, and waitlist_entries) wrapped in atomic transactions to prevent overbooking.
Whenever a confirmed member cancels their slot, the system automatically promotes the first person from the waitlist in First-In, First-Out (FIFO) order.
Every confirmed booking generates a unique cryptographic check-in code that staff can verify at the gym door.
Sessions are assumed to run for one hour starting on the hour, and admin accounts are seeded directly into the database rather than through public registration.
To set up the project locally, clone the repository, run npm install to get the dependencies, and create a .env file in the root directory with your JWT_SECRET key.
Run node server.js in your terminal to initialize the local database and start the application at http://localhost:3000.
You can test the application using the admin account (admin@gym.com / adminpassword123) or the member account (rahul@123.com / password123).
