# ranobe-ebook-loader
Юзерскрипт для скачивания книг (fb2, epub) c https://ранобэ.рф/ , https://ranobes.com/ и https://tl.rulate.ru/

![icon from https://icon-icons.com/icon/book-shelf-book/54414](https://raw.githubusercontent.com/Taraflex/ranobe-ebook-loader/master/icons/128.png)

[Поддержка браузерами](https://caniuse.com/#feat=abortcontroller)

О проблемах в работе скрипта сообщать [тут](https://github.com/Taraflex/ranobe-ebook-loader/issues).

## Как использовать

- Установить расширение 
    > [Violentmonkey](https://violentmonkey.github.io/get-it/) 
    Рекомендуемый вариант, так как разрешает кроссдоменные запросы для скачивания иллюстраций

    или 
    > [Tampermonkey](https://tampermonkey.net/) 
    Будет спрашивать разрешение для скачивания иллюстраций со сторонних хостов
    
    или 
    > [Greasemonkey](https://www.greasespot.net/) 
    
    или 
    > ~~[FireMonkey](https://addons.mozilla.org/ru/firefox/addon/firemonkey/)~~ пока не поддерживается
   
    или любое другое для поддержки юзерскриптов в вашем браузере.

- [Нажать для установки юзерскрипта](https://raw.githubusercontent.com/Taraflex/ranobe-ebook-loader/master/build/ranobe-ebook-loader.user.js)
- Перейти на страницу с книгой и дождаться её прогрузки
- На странице появятся кнопки для скачивания книг (в Firefox кнопки также доступны через контекстное меню страницы)
![](https://raw.githubusercontent.com/Taraflex/ranobe-ebook-loader/master/screenshots/rulate.png)
![](https://raw.githubusercontent.com/Taraflex/ranobe-ebook-loader/master/screenshots/ranobe.png)
![](https://raw.githubusercontent.com/Taraflex/ranobe-ebook-loader/master/screenshots/ranobes.png)
Так же epub можно скачать нажав <kbd>CTRL</kbd>+<kbd>S</kbd>