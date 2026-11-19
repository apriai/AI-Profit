# Prueba en demo

Antes de usar esto en una cuenta de evaluación, pruébalo en una cuenta demo o sim de Tradovate, con **1 contrato**.

1. En el gráfico, MNQ (o NQ) con el contrato de adelante visible.
2. En la granja, elige esa cuenta demo y una estrategia de stop fijo (Rascacielo sirve).
3. BUY o SELL de 1 contrato.
4. En la boleta de TradingView, la orden a mercado debe haber entrado **con** stop y objetivo. No debe aparecer una orden suelta.
5. El `parentId` del stop y del objetivo es el id de la orden de entrada, o el id de la posición.
6. La posición trae `lastPrice`. Si no lo trae, el stop igual debe verse del lado bueno del bid (compra) o del ask (venta).
7. Cierra a mano una parte, o deja que salga el objetivo. El stop que sobra tiene que cancelarse con el bracket. No debe quedar un stop trabajando con la cuenta ya plana.
8. Si la granja dice «NO VEO EL STOP», suena el aviso y aparece el botón «Poner stop». Ese botón no se pulsa solo.

No uses una cuenta fondeada para esta prueba.
