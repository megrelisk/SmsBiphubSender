// სატესტო შაბლონები: node --env-file=.env src/seed.js   (ან: npm run seed -w server)
// უკვე არსებულ შაბლონებს (იგივე კაბინეტი + სახელი) არ ეხება.
import { migrate, query, pool } from './db.js';

const TEMPLATES = [
  ['kea', 'გაკვეთილის შეხსენება', 'გამარჯობა {{name}}, შეგახსენებთ, რომ გაკვეთილი იწყება {{date}} {{time}} საათზე. KEA Academy'],
  ['kea', 'გადახდის შეხსენება', 'გამარჯობა {{name}}, გახსენებთ {{amount}} ლარის გადახდას {{date}}-მდე. KEA Academy'],
  ['kea', 'რეგისტრაცია გაიხსნა', 'გამარჯობა {{name}}, KEA Academy-ში გაიხსნა რეგისტრაცია კურსზე: {{course}}. დეტალებისთვის დაგვიკავშირდით.'],
  ['mindup', 'ახალი ჯგუფი', 'გამარჯობა {{name}}, Mind up-ში იწყება ახალი ჯგუფი {{date}}-ს. ადგილების რაოდენობა შეზღუდულია.'],
  ['mindup', 'სესიის დადასტურება', '{{name}}, თქვენი სესია Mind up-ში დადასტურებულია: {{date}}, {{time}} საათი. გელოდებით!'],
  ['mindup', 'გადახდის შეხსენება', 'გამარჯობა {{name}}, შეგახსენებთ {{amount}} ლარის გადახდას Mind up-ის სერვისებზე.'],
];

await migrate();
for (const [cabinet, name, body] of TEMPLATES) {
  await query(
    'INSERT INTO templates (cabinet, name, body) VALUES ($1,$2,$3) ON CONFLICT (cabinet, folder, name) DO NOTHING',
    [cabinet, name, body],
  );
}
console.log(`შაბლონები დამატებულია (${TEMPLATES.length})`);
await pool.end();
