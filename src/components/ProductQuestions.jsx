import React, { useEffect, useMemo, useState } from 'react'
import {
  Flag,
  HelpCircle,
  Loader2,
  MessageCircle,
  Send,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  answerProductQuestion,
  createProductQuestion,
  listProductQuestions,
} from '@/api/module12'
import ReportModal from '@/components/ReportModal'
import {
  Button,
  Textarea,
} from '@/components/ui'
import { useAuth } from '@/lib/AuthContext'

function formatDate(value) {
  if (!value) return ''

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

export default function ProductQuestions({
  productId,
}) {
  const { user } = useAuth()

  const [product, setProduct] = useState(null)
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [questionText, setQuestionText] = useState('')
  const [asking, setAsking] = useState(false)
  const [answeringId, setAnsweringId] = useState(null)
  const [answerText, setAnswerText] = useState('')
  const [sendingAnswer, setSendingAnswer] = useState(false)
  const [reportTarget, setReportTarget] = useState(null)

  const isOwner = useMemo(
    () =>
      Boolean(
        user &&
        product?.seller_id &&
        Number(user.id) === Number(product.seller_id)
      ),
    [user, product]
  )

  const load = async () => {
    const data = await listProductQuestions(productId)
    setProduct(data.product || null)
    setQuestions(data.questions || [])
  }

  useEffect(() => {
    let active = true
    setLoading(true)

    listProductQuestions(productId)
      .then(data => {
        if (!active) return
        setProduct(data.product || null)
        setQuestions(data.questions || [])
      })
      .catch(error => {
        if (active) {
          toast.error(
            error.message ||
              'Não foi possível carregar as perguntas.'
          )
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [productId])

  const submitQuestion = async event => {
    event.preventDefault()

    const text = questionText.trim()

    if (!text) {
      return toast.error('Digite uma pergunta.')
    }

    if (text.length > 500) {
      return toast.error(
        'A pergunta pode ter no máximo 500 caracteres.'
      )
    }

    setAsking(true)

    try {
      await createProductQuestion(productId, text)
      setQuestionText('')
      await load()
      toast.success('Pergunta publicada.')
    } catch (error) {
      // Importante: NÃO limpa o campo quando o anti-contato bloquear,
      // permitindo que a pessoa corrija o texto.
      toast.error(
        error.message ||
          'Não foi possível enviar a pergunta.'
      )
    } finally {
      setAsking(false)
    }
  }

  const submitAnswer = async questionId => {
    const text = answerText.trim()

    if (!text) {
      return toast.error('Digite uma resposta.')
    }

    if (text.length > 500) {
      return toast.error(
        'A resposta pode ter no máximo 500 caracteres.'
      )
    }

    setSendingAnswer(true)

    try {
      await answerProductQuestion(questionId, text)
      setAnswerText('')
      setAnsweringId(null)
      await load()
      toast.success('Resposta publicada.')
    } catch (error) {
      // Mantém a resposta digitada quando for bloqueada.
      toast.error(
        error.message ||
          'Não foi possível enviar a resposta.'
      )
    } finally {
      setSendingAnswer(false)
    }
  }

  const reportQuestion = question => {
    setReportTarget({
      reportedUserId: question.author_id,
      productId: Number(productId),
      questionId: question.id,
      answerId: null,
      contextType: 'qa',
      contextLabel: 'Pergunta no anúncio',
      contextDescription:
        `Pergunta denunciada no Q&A do produto #${productId}: ${question.text}`,
    })
  }

  const reportAnswer = (question, answer) => {
    setReportTarget({
      reportedUserId: answer.seller_id,
      productId: Number(productId),
      questionId: null,
      answerId: answer.id,
      contextType: 'qa',
      contextLabel: 'Resposta do vendedor no anúncio',
      contextDescription:
        `Resposta denunciada no Q&A do produto #${productId}: ${answer.text}`,
    })
  }

  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pb-10 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 sm:p-6">
          <div className="mb-5 flex items-start gap-3">
            <div className="rounded-xl bg-[#5A5FBF]/10 p-2 text-[#0D1273]">
              <HelpCircle className="h-5 w-5" />
            </div>

            <div>
              <h2 className="font-heading text-xl font-bold text-[#0D1273]">
                Perguntas e Respostas
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Tire dúvidas sobre o anúncio sem compartilhar contatos pessoais.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-[#0D1273]" />
            </div>
          ) : (
            <div className="space-y-4">
              {questions.length === 0 ? (
                <div className="rounded-xl bg-gray-50 p-5 text-center text-sm text-gray-400">
                  Ainda não há perguntas neste anúncio.
                </div>
              ) : (
                questions.map(question => (
                  <article
                    key={question.id}
                    className="rounded-2xl border border-gray-100 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-[#0D1273]">
                            {question.author_name || 'Anônimo'}
                          </span>

                          <span className="text-xs text-gray-400">
                            {formatDate(question.created_at)}
                          </span>
                        </div>

                        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-700">
                          {question.text}
                        </p>
                      </div>

                      {user &&
                        Number(user.id) !== Number(question.author_id) && (
                          <button
                            type="button"
                            onClick={() => reportQuestion(question)}
                            className="shrink-0 rounded-lg p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                            title="Denunciar pergunta"
                          >
                            <Flag className="h-4 w-4" />
                          </button>
                        )}
                    </div>

                    {question.answer ? (
                      <div className="mt-4 rounded-xl bg-[#5A5FBF]/5 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-[#0D1273]">
                                {question.answer.seller_name}
                              </span>

                              <span className="rounded-full bg-[#0D1273] px-2 py-0.5 text-[10px] font-semibold text-white">
                                Vendedor
                              </span>

                              <span className="text-xs text-gray-400">
                                {formatDate(question.answer.created_at)}
                              </span>
                            </div>

                            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-700">
                              {question.answer.text}
                            </p>
                          </div>

                          {user &&
                            Number(user.id) !==
                              Number(question.answer.seller_id) && (
                              <button
                                type="button"
                                onClick={() =>
                                  reportAnswer(
                                    question,
                                    question.answer
                                  )
                                }
                                className="shrink-0 rounded-lg p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                                title="Denunciar resposta"
                              >
                                <Flag className="h-4 w-4" />
                              </button>
                            )}
                        </div>
                      </div>
                    ) : (
                      isOwner && (
                        <div className="mt-4">
                          {answeringId === question.id ? (
                            <div className="space-y-2 rounded-xl bg-gray-50 p-3">
                              <Textarea
                                rows={3}
                                maxLength={500}
                                value={answerText}
                                onChange={event =>
                                  setAnswerText(event.target.value)
                                }
                                placeholder="Responda a dúvida do comprador..."
                              />

                              <div className="flex items-center justify-between gap-3">
                                <span className="text-xs text-gray-400">
                                  {answerText.length}/500
                                </span>

                                <div className="flex gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setAnsweringId(null)
                                      setAnswerText('')
                                    }}
                                    disabled={sendingAnswer}
                                  >
                                    Cancelar
                                  </Button>

                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() =>
                                      submitAnswer(question.id)
                                    }
                                    disabled={
                                      sendingAnswer ||
                                      !answerText.trim()
                                    }
                                  >
                                    {sendingAnswer ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <>
                                        <Send className="mr-1 h-4 w-4" />
                                        Responder
                                      </>
                                    )}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setAnsweringId(question.id)
                                setAnswerText('')
                              }}
                            >
                              <MessageCircle className="mr-2 h-4 w-4" />
                              Responder
                            </Button>
                          )}
                        </div>
                      )
                    )}
                  </article>
                ))
              )}

              {!isOwner && (
                <div className="border-t border-gray-100 pt-5">
                  {user ? (
                    <form
                      onSubmit={submitQuestion}
                      className="space-y-3"
                    >
                      <div>
                        <Textarea
                          rows={4}
                          maxLength={500}
                          value={questionText}
                          onChange={event =>
                            setQuestionText(event.target.value)
                          }
                          placeholder="Faça uma pergunta sobre este produto..."
                        />

                        <div className="mt-1 flex justify-between text-xs text-gray-400">
                          <span>
                            Não compartilhe telefone, e-mail, links ou redes sociais.
                          </span>
                          <span>{questionText.length}/500</span>
                        </div>
                      </div>

                      <Button
                        disabled={
                          asking ||
                          !questionText.trim()
                        }
                      >
                        {asking ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Enviando...
                          </>
                        ) : (
                          <>
                            <Send className="mr-2 h-4 w-4" />
                            Fazer pergunta
                          </>
                        )}
                      </Button>
                    </form>
                  ) : (
                    <div className="rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
                      <Link
                        to="/login"
                        className="font-semibold text-[#0D1273] hover:underline"
                      >
                        Faça login para perguntar
                      </Link>
                      .
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <ReportModal
        open={Boolean(reportTarget)}
        onClose={() => setReportTarget(null)}
        reporterId={user?.id}
        reportedUserId={reportTarget?.reportedUserId}
        productId={reportTarget?.productId}
        questionId={reportTarget?.questionId}
        answerId={reportTarget?.answerId}
        contextType={reportTarget?.contextType}
        contextLabel={reportTarget?.contextLabel}
        contextDescription={reportTarget?.contextDescription}
        initialCategory="conteudo_ofensivo"
      />
    </>
  )
}
