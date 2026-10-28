/* products.js — товары заказчика (названия, составы, фото в папке img/).
   Цены и метки приходят из Google Таблицы, здесь они не хранятся.
   ДЕМО-ДАННЫЕ: замените на товары заказчика. Название товара здесь и в таблице цен должно совпадать. */
/* ===== ТОВАРЫ =====
   image: путь к фото в img/ (WebP 560×560); kk: перевод на казахский; labels: ["halal","new","hit","sale"] */
const PRODUCTS = [
  {name:"Демо-товар 1", brand:"Demo", category:"Закуски", weight:"", price:null, labels:[], image:"img/placeholder.webp",
   composition:"Пример состава: ингредиент 1, ингредиент 2, ингредиент 3.", shelfLife:"", nutrition:"На 100 г: белки 0,0 г, жиры 0,0 г, углеводы 0,0 г, 0 ккал",
   kk:{name:"Демо-тауар 1",composition:"Құрамының үлгісі: ингредиент 1, ингредиент 2, ингредиент 3.",nutrition:"100 г-да: ақуыз 0,0 г, май 0,0 г, көмірсу 0,0 г, 0 ккал"}},
  {name:"Демо-товар 2", brand:"Demo", category:"Закуски", weight:"", price:null, labels:["halal"], image:"img/placeholder.webp",
   composition:"Пример состава: ингредиент 1, ингредиент 2.", shelfLife:"", nutrition:"",
   kk:{name:"Демо-тауар 2",composition:"Құрамының үлгісі: ингредиент 1, ингредиент 2."}},
  {name:"Демо-товар 3", brand:"Demo", category:"Напитки", weight:"", price:null, labels:[], image:"img/placeholder.webp",
   composition:"Пример состава: вода, сахар.", shelfLife:"", nutrition:"",
   kk:{name:"Демо-тауар 3",composition:"Құрамының үлгісі: су, қант."}}
];
