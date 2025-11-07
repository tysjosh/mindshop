# RAG Assistant Widget - Integration Quick Start

## 🚀 Get Started in 3 Steps

### Step 1: Get Your Credentials

1. Log in to your [RAG Assistant Dashboard](https://dashboard.rag-assistant.com)
2. Navigate to **API Keys**
3. Copy your **Merchant ID** and **API Key**

### Step 2: Add the Embed Code

Copy and paste this code before the closing `</body>` tag of your website:

```html
<script>
  (function(w,d,s,o,f,js,fjs){
    w['RAGAssistant']=o;w[o]=w[o]||function(){(w[o].q=w[o].q||[]).push(arguments)};
    js=d.createElement(s),fjs=d.getElementsByTagName(s)[0];
    js.id=o;js.src=f;js.async=1;fjs.parentNode.insertBefore(js,fjs);
  }(window,document,'script','ra','https://cdn.rag-assistant.com/v1/widget.js'));
  
  ra('init', {
    merchantId: 'YOUR_MERCHANT_ID',
    apiKey: 'YOUR_API_KEY'
  });
</script>
```

**Important:** Replace `YOUR_MERCHANT_ID` and `YOUR_API_KEY` with your actual credentials.

### Step 3: Customize (Optional)

Add theme and behavior options:

```html
<script>
  (function(w,d,s,o,f,js,fjs){
    w['RAGAssistant']=o;w[o]=w[o]||function(){(w[o].q=w[o].q||[]).push(arguments)};
    js=d.createElement(s),fjs=d.getElementsByTagName(s)[0];
    js.id=o;js.src=f;js.async=1;fjs.parentNode.insertBefore(js,fjs);
  }(window,document,'script','ra','https://cdn.rag-assistant.com/v1/widget.js'));
  
  ra('init', {
    merchantId: 'YOUR_MERCHANT_ID',
    apiKey: 'YOUR_API_KEY',
    
    // Customize appearance
    theme: {
      primaryColor: '#007bff',
      position: 'bottom-right'
    },
    
    // Customize behavior
    behavior: {
      autoOpen: false,
      greeting: 'Hi! 👋 How can I help you today?',
      maxRecommendations: 3
    },
    
    // Add cart integration
    integration: {
      addToCartCallback: (product) => {
        // Your add to cart logic here
        console.log('Add to cart:', product);
      }
    }
  });
</script>
```

## 📱 Platform-Specific Integration

### Shopify

1. Go to **Online Store → Themes**
2. Click **Actions → Edit code**
3. Open **theme.liquid**
4. Paste the embed code before `</body>`
5. Save

### WooCommerce

1. Go to **Appearance → Theme Editor**
2. Select **footer.php**
3. Paste the embed code before `</body>`
4. Click **Update File**

### BigCommerce

1. Go to **Storefront → Script Manager**
2. Click **Create a Script**
3. Set location to **Footer**
4. Paste the embed code
5. Save

### Custom Platform

Add the embed code to your HTML template before the closing `</body>` tag.

## 🎨 Use the Code Generator

Visit our [Interactive Code Generator](examples/embed-generator.html) to:
- Generate custom embed code
- Preview different themes
- Get platform-specific integration code
- Copy ready-to-use snippets

## 📚 Learn More

- **[Complete Embed Guide](EMBED_GUIDE.md)** - Detailed integration instructions
- **[Embed README](EMBED_README.md)** - Technical documentation
- **[Examples](examples/)** - Working code examples
- **[Dashboard](https://dashboard.rag-assistant.com)** - Manage your integration

## 🆘 Need Help?

- **Documentation**: https://docs.rag-assistant.com
- **Support Email**: support@rag-assistant.com
- **Live Chat**: Available in your dashboard

## ✅ Checklist

- [ ] Got Merchant ID and API Key from dashboard
- [ ] Added embed code to website
- [ ] Replaced placeholder credentials with real ones
- [ ] Tested widget appears on your site
- [ ] Customized theme and behavior (optional)
- [ ] Added cart integration callback (optional)
- [ ] Tested on mobile devices
- [ ] Checked browser console for errors

## 🎉 You're Done!

The widget should now appear on your website. Click the chat button to test it out!

**Pro Tip:** Use `pk_test_...` keys for testing and `pk_live_...` keys for production.
