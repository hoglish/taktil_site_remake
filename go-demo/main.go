// Тактиль — необязательный демонстрационный модуль на Go.
//
// Тема: «Карточка товара в каталоге» (catalog.html).
// Сайт — это чистые HTML/CSS/JS и работает без этого модуля: здесь та же логика
// (цена со скидкой, статус товара, краткое резюме карточки), записанная на Go.
//
// В программе используются: строки, числа (int, float64), логические значения,
// объекты (структуры), арифметические операторы, операторы сравнения и логические операторы.
//
// Запуск:  go run .
// Тесты:   go test ./...
package main

import (
	"fmt"
	"strings"
)

// Product — «объект» товара, как в js/data.js на сайте.
type Product struct {
	ID     string  // строка
	Title  string  // строка
	Type   string  // строка: keyboard | keycaps | switches | accessories
	Price  int     // число: текущая цена, ₽
	Old    int     // число: старая цена, ₽ (0 — скидки нет)
	Stock  int     // число: остаток на складе
	Rating float64 // число: рейтинг 0..5
	Hot    bool    // логическое значение: бейдж «Хит»
}

// Status — статус товара для карточки.
type Status struct {
	Code   string // in-stock | few | preorder | out
	Label  string // подпись для покупателя
	CanBuy bool   // можно ли положить в корзину
}

// Summary — краткий результат по карточке.
type Summary struct {
	Title       string
	PriceText   string
	DiscountPct int
	Saved       int
	Status      Status
	Line        string
}

const (
	freeShipFrom = 7000 // бесплатная доставка от этой суммы
	shipCost     = 390  // стоимость доставки
	lowStock     = 3    // «осталось мало» при остатке не больше этого числа
)

// FormatPrice форматирует цену с пробелами-разделителями тысяч: 12900 -> "12 900 ₽".
func FormatPrice(rub int) string {
	if rub < 0 { // сравнение
		return "−" + FormatPrice(-rub)
	}
	s := fmt.Sprint(rub)
	var b strings.Builder
	for i, r := range s {
		if i > 0 && (len(s)-i)%3 == 0 { // арифметика: остаток от деления
			b.WriteRune(' ')
		}
		b.WriteRune(r)
	}
	return b.String() + " ₽"
}

// CalcDiscount считает скидку: процент и сумму экономии. Если old <= price, скидки нет.
func CalcDiscount(price, old int) (percent, saved int) {
	if old <= 0 || old <= price { // логическое ИЛИ + сравнения
		return 0, 0
	}
	saved = old - price
	percent = (saved*100 + old/2) / old // округление к ближайшему целому
	return percent, saved
}

// ApplyPromo применяет промокод к сумме: TACT10 — 10%, WELCOME — 500 ₽ при заказе от 3000 ₽.
func ApplyPromo(total int, code string) (int, bool) {
	switch strings.ToUpper(strings.TrimSpace(code)) {
	case "TACT10":
		return total - total*10/100, true
	case "WELCOME":
		if total >= 3000 {
			return total - 500, true
		}
	}
	return total, false
}

// DeliveryCost — стоимость доставки по сумме заказа.
func DeliveryCost(total int) int {
	if total >= freeShipFrom {
		return 0
	}
	return shipCost
}

// ProductStatus определяет статус товара по остатку и рейтингу.
func ProductStatus(p Product) Status {
	available := p.Stock > 0
	scarce := available && p.Stock <= lowStock
	switch {
	case !available && p.Price > 0:
		return Status{"preorder", "Под заказ", true}
	case !available:
		return Status{"out", "Нет в наличии", false}
	case scarce:
		return Status{"few", fmt.Sprintf("Осталось %d шт.", p.Stock), true}
	case p.Hot || p.Rating >= 4.8: // логическое ИЛИ
		return Status{"in-stock", "В наличии · хит продаж", true}
	}
	return Status{"in-stock", "В наличии", true}
}

// Summarize формирует краткий результат по товару для вывода в консоль.
func Summarize(p Product) Summary {
	pct, saved := CalcDiscount(p.Price, p.Old)
	st := ProductStatus(p)
	line := fmt.Sprintf("%-18s %10s", p.Title, FormatPrice(p.Price))
	if pct > 0 {
		line += fmt.Sprintf("  (было %s, −%d%%, экономия %s)", FormatPrice(p.Old), pct, FormatPrice(saved))
	}
	line += "  | " + st.Label
	if !st.CanBuy {
		line += " ✗"
	}
	return Summary{p.Title, FormatPrice(p.Price), pct, saved, st, line}
}

func main() {
	catalog := []Product{
		{"nova-65", "Nova 65", "keyboard", 12900, 14900, 8, 4.9, true},
		{"retro-75", "Retro 75", "keyboard", 9900, 0, 2, 4.7, false},
		{"matcha-keycaps", "Matcha", "keycaps", 3900, 4600, 12, 4.6, false},
		{"tishina-silent", "«Тишина»", "switches", 2400, 0, 0, 4.8, false},
		{"toolkit", "Набор мастера", "accessories", 1500, 0, 25, 4.5, false},
	}

	fmt.Println("=== Тактиль · каталог (демо на Go) ===")
	total := 0
	for i, p := range catalog {
		s := Summarize(p)
		fmt.Printf("%d. %s\n", i+1, s.Line)
		if s.Status.CanBuy && p.Stock > 0 {
			total += p.Price
		}
	}

	fmt.Println()
	fmt.Println("--- Корзина из товаров в наличии ---")
	fmt.Println("Сумма:          ", FormatPrice(total))
	for _, code := range []string{"TACT10", "WELCOME", "SALE"} {
		res, ok := ApplyPromo(total, code)
		if ok {
			fmt.Printf("Промокод %-8s → %s (экономия %s)\n", code, FormatPrice(res), FormatPrice(total-res))
		} else {
			fmt.Printf("Промокод %-8s → не подошёл\n", code)
		}
	}
	fmt.Println("Доставка:       ", FormatPrice(DeliveryCost(total)))
	fmt.Println("Бесплатная доставка от", FormatPrice(freeShipFrom), "—", total >= freeShipFrom)
}
