# Heroku Deployment Instructions for Order Keeper V2

This guide explains how to deploy the Order Keeper V2 to Heroku as a standalone worker process.

## Prerequisites

1. Heroku CLI installed
2. Heroku account
3. Git installed

## Deployment Steps

### 1. Create a new Heroku app

```bash
heroku create your-keeper-app-name
```

### 2. Set up environment variables

Set the required environment variables on Heroku:

```bash
# Use either Infura or Alchemy (at least one required)
heroku config:set INFURA_KEY=your_infura_key_here
# OR
heroku config:set ALCHEMY_KEY=your_alchemy_key_here

# Set your private key for executing transactions (required)
heroku config:set UPDATER_PRIVATE_KEY=your_private_key_here_without_0x_prefix
```

### 3. Deploy using Git subtree (from the main project root)

Since we only want to deploy the keeper folder, use git subtree from your main project root:

```bash
# From the gmx-synthetics directory (NOT from the keeper folder)
git subtree push --prefix keeper heroku main
```

Alternative method if subtree doesn't work:

```bash
# Create a new branch with only the keeper folder
git subtree split --prefix=keeper -b keeper-only

# Push this branch to Heroku
git push heroku keeper-only:main

# Clean up the temporary branch
git branch -d keeper-only
```

### 4. Scale the worker dyno

Since we're running a worker process (not a web server), scale it appropriately:

```bash
heroku ps:scale worker=1
```

### 5. Monitor logs

Check if the keeper is running properly:

```bash
heroku logs --tail
```

## Important Notes

- The keeper runs as a **worker** dyno, not a web dyno
- It will run continuously, listening for blockchain events
- Make sure your Heroku account has sufficient dyno hours
- The free tier may sleep after 30 minutes of inactivity; consider using a paid dyno for production

## Troubleshooting

### If deployment fails:

1. Check that all files are committed to git
2. Verify environment variables are set correctly
3. Check Python version compatibility (we use 3.11.6)

### To restart the keeper:

```bash
heroku ps:restart worker
```

### To stop the keeper temporarily:

```bash
heroku ps:scale worker=0
```

### To resume:

```bash
heroku ps:scale worker=1
```

## Monitoring and Maintenance

- Use `heroku logs --tail` to monitor real-time logs
- Set up Heroku alerts for dyno crashes
- Consider adding error reporting service (e.g., Sentry) for production use

## Cost Considerations

- Worker dynos run 24/7 and consume dyno hours continuously
- Free tier provides 550-1000 hours/month (depending on account verification)
- For production, consider Eco or Basic dynos for better reliability

## Security Notes

- Never commit `.env` file with real keys
- Use Heroku config vars for all sensitive data
- Rotate private keys regularly
- Consider using a separate account/key for production keeper operations