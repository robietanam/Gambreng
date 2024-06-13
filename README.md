# Gambreng

## Website _Gambar Bareng_

Gambreng adalah aplikasi berbasis website yang memungkinkan kamu menggambar dan berinteraksi dengan canvas bersama.

- Menggambar menulis di canvas
- Penyimpanan file
- ✨Kolaborasi ✨

## Tech Stack

- Next.Js - Frontend and Backend Framework!
- Socket.Io - Library web socket paling populer
- Tailwind - UI library
- MySql (Prisma ORM) - ORM untuk database
- Rough.js - Library untuk membuat shape

## Instalasi

Setup .env

- tambahkan pada .

```sh
DATABASE_URL="mysql://[username]:[pass]@[hostdb]:[portdb]/[nama_table]"
```

contoh

```sh
DATABASE_URL="mysql://canvas-pemrojar:123@localhost:3306/canvas_pemrojar"
```

```sh
npm install
```

```sh
npx prisma db push
```

Untuk menjalankan pada mode developemnt

```sh
npm run dev
```

Untuk production

```sh
npm run build
```

```sh
npm run start
```

## Note V2

- Canvas inspired by Redhwan Nacef
- https://www.youtube.com/watch?v=6arkndScw7A&list=PLSxgVLtIB0IFmQGuVMSE_wDHPW5rq4Ik7.
