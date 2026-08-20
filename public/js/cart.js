export let cart = JSON.parse(localStorage.getItem("gas_cart")) || [];

export function addToCart(product) {
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({ ...product, quantity: 1 });
    }
    localStorage.setItem("gas_cart", JSON.stringify(cart));
    alert("Product added to cart.");
}
