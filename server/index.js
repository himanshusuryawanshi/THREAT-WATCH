import express    from 'express'
import cors       from 'cors'
import dotenv     from 'dotenv'
import eventsRouter from './routes/events.js'

dotenv.config({ path: '../.env' })

const app  = express()
const PORT = process.env.PORT || 3001

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET'],
}))
app.use(express.json())

// Routes
app.use('/api/events', eventsRouter)

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status:  'ok',
    time:    new Date().toISOString(),
    source:  'ThreatWatch API',
  })
})

app.listen(PORT, () => {
  console.log(`ThreatWatch API running on http://localhost:${PORT}`)
  console.log(`ACLED email: ${process.env.ACLED_EMAIL}`)
})