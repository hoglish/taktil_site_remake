package main

import "testing"

func TestFormatPrice(t *testing.T) {
	cases := map[int]string{0: "0 ₽", 999: "999 ₽", 1500: "1 500 ₽", 12900: "12 900 ₽", 1234567: "1 234 567 ₽"}
	for in, want := range cases {
		if got := FormatPrice(in); got != want {
			t.Errorf("FormatPrice(%d) = %q, want %q", in, got, want)
		}
	}
}

func TestCalcDiscount(t *testing.T) {
	if p, s := CalcDiscount(12900, 14900); p != 13 || s != 2000 {
		t.Errorf("got %d%% / %d", p, s)
	}
	if p, s := CalcDiscount(9900, 0); p != 0 || s != 0 {
		t.Errorf("no discount expected, got %d%% / %d", p, s)
	}
}

func TestProductStatus(t *testing.T) {
	if st := ProductStatus(Product{Price: 100, Stock: 0}); st.Code != "preorder" {
		t.Errorf("preorder expected, got %s", st.Code)
	}
	if st := ProductStatus(Product{Price: 100, Stock: 2}); st.Code != "few" {
		t.Errorf("few expected, got %s", st.Code)
	}
	if st := ProductStatus(Product{Price: 100, Stock: 9, Hot: true}); !st.CanBuy {
		t.Error("hot product must be buyable")
	}
}

func TestPromoAndDelivery(t *testing.T) {
	if v, ok := ApplyPromo(10000, "tact10"); !ok || v != 9000 {
		t.Errorf("TACT10: %d %v", v, ok)
	}
	if _, ok := ApplyPromo(2000, "WELCOME"); ok {
		t.Error("WELCOME needs 3000+")
	}
	if DeliveryCost(7000) != 0 || DeliveryCost(6999) != shipCost {
		t.Error("delivery threshold")
	}
}
