/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
  Button,
} from 'npm:@react-email/components@0.0.22'

import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'ScoutFoto'
const SITE_URL = 'https://scoutfoto.app'

interface Props {
  nomeAssociado?: string
  secao?: string
  dirigente?: string
  cargo1?: string
  cargo2?: string
  data?: string
  horario?: string
  local?: string
  ramo?: string
  tipoAtividade?: string
  observacoes?: string
  emailDe?: string
  emailPara?: string
  destinatarioNome?: string
  destinatarioSecao?: string
  destinatarioCargo1?: string
  destinatarioCargo2?: string
}

const AgendamentoNotificacaoEmail = ({
  nomeAssociado,
  secao,
  dirigente,
  cargo1,
  cargo2,
  data,
  horario,
  local,
  ramo,
  tipoAtividade,
  observacoes,
  emailDe,
  emailPara,
  destinatarioNome,
  destinatarioSecao,
  destinatarioCargo1,
  destinatarioCargo2,
}: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Novo agendamento — {tipoAtividade ?? 'atividade'} em {data ?? 'data a confirmar'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Novo Agendamento Confirmado</Heading>
        <Text style={text}>
          Um novo agendamento foi registrado no <strong>{SITE_NAME}</strong> e já está
          confirmado no Calendário Escoteiro.
        </Text>

        <Section style={card}>
          <Heading as="h2" style={h2}>Dados do remetente</Heading>
          {nomeAssociado && <Text style={detail}><strong>Nome:</strong> {nomeAssociado}</Text>}
          {secao && <Text style={detail}><strong>Seção:</strong> {secao}</Text>}
          {cargo1 && <Text style={detail}><strong>Cargo 1:</strong> {cargo1}</Text>}
          {cargo2 && <Text style={detail}><strong>Cargo 2:</strong> {cargo2}</Text>}
          {emailDe && <Text style={detail}><strong>E-mail:</strong> {emailDe}</Text>}
        </Section>

        {(destinatarioNome || destinatarioSecao || destinatarioCargo1 || emailPara) && (
          <Section style={card}>
            <Heading as="h2" style={h2}>Dados do destinatário</Heading>
            {destinatarioNome && <Text style={detail}><strong>Nome:</strong> {destinatarioNome}</Text>}
            {destinatarioSecao && <Text style={detail}><strong>Seção:</strong> {destinatarioSecao}</Text>}
            {destinatarioCargo1 && <Text style={detail}><strong>Cargo 1:</strong> {destinatarioCargo1}</Text>}
            {destinatarioCargo2 && <Text style={detail}><strong>Cargo 2:</strong> {destinatarioCargo2}</Text>}
            {emailPara && <Text style={detail}><strong>E-mail:</strong> {emailPara}</Text>}
          </Section>
        )}

        <Section style={cardAccent}>
          <Heading as="h2" style={h2}>Detalhes do evento</Heading>
          {tipoAtividade && <Text style={detail}><strong>Tipo de atividade:</strong> {tipoAtividade}</Text>}
          {ramo && <Text style={detail}><strong>Ramo escoteiro:</strong> {ramo}</Text>}
          {data && <Text style={detail}><strong>Data:</strong> {data}</Text>}
          {horario && <Text style={detail}><strong>Horário:</strong> {horario}</Text>}
          {local && <Text style={detail}><strong>Local:</strong> {local}</Text>}
        </Section>

        {observacoes && (
          <Section style={card}>
            <Heading as="h2" style={h2}>Observações</Heading>
            <Text style={detail}>{observacoes}</Text>
          </Section>
        )}

        {(emailDe || emailPara) && (
          <Section style={cardMuted}>
            <Heading as="h2" style={h2}>Contatos</Heading>
            {emailDe && <Text style={detail}><strong>De:</strong> {emailDe}</Text>}
            {emailPara && <Text style={detail}><strong>Para:</strong> {emailPara}</Text>}
          </Section>
        )}

        <Section style={{ textAlign: 'center', margin: '28px 0 8px' }}>
          <Button style={button} href={`${SITE_URL}/calendar`}>
            Ver no Calendário Escoteiro
          </Button>
        </Section>

        <Hr style={hr} />

        <Text style={footer}>
          Atenciosamente,<br />
          Equipe {SITE_NAME} — 12º Grupo Escoteiro Monte Caburaí
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: AgendamentoNotificacaoEmail,
  subject: (data: Record<string, any>) =>
    `Novo Agendamento — ${data.tipoAtividade ?? 'Atividade'}`,
  displayName: 'Notificação de Agendamento (Scotfoto)',
  previewData: {
    nomeAssociado: 'Maria Silva',
    secao: 'Alcateia',
    dirigente: 'João Souza',
    cargo1: 'Chefe de Seção',
    cargo2: '',
    data: '15/05/2026',
    horario: '14:00',
    local: 'Sede do Grupo',
    ramo: '🐺 Lobinho',
    tipoAtividade: 'Reunião',
    observacoes: 'Reunião ordinária da Alcateia, com atividade ao ar livre.',
    emailDe: 'maria@exemplo.com',
    emailPara: 'coordenacao@exemplo.com',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '20px 25px', maxWidth: '600px' }
const h1 = {
  fontFamily: "'Space Grotesk', sans-serif",
  fontSize: '24px',
  fontWeight: 'bold' as const,
  color: '#191F25',
  margin: '0 0 20px',
  letterSpacing: '-0.02em',
}
const h2 = {
  fontFamily: "'Space Grotesk', sans-serif",
  fontSize: '16px',
  fontWeight: '600' as const,
  color: '#191F25',
  margin: '0 0 12px',
}
const text = {
  fontSize: '14px',
  color: '#606B73',
  lineHeight: '1.6',
  margin: '0 0 16px',
}
const card = {
  backgroundColor: '#F6F3ED',
  borderRadius: '12px',
  padding: '16px 20px',
  margin: '12px 0',
  border: '1px solid #E5E0D5',
}
const cardAccent = {
  backgroundColor: '#EAF3EC',
  borderRadius: '12px',
  padding: '16px 20px',
  margin: '12px 0',
  border: '1px solid #C9E1CF',
}
const cardMuted = {
  backgroundColor: '#FAFAF8',
  borderRadius: '12px',
  padding: '16px 20px',
  margin: '12px 0',
  border: '1px solid #ECE9E1',
}
const detail = {
  fontSize: '13px',
  color: '#191F25',
  margin: '4px 0',
  lineHeight: '1.5',
}
const button = {
  backgroundColor: '#2B6E3F',
  color: '#F6F3ED',
  fontSize: '14px',
  fontWeight: '600' as const,
  borderRadius: '12px',
  padding: '14px 28px',
  textDecoration: 'none',
  display: 'inline-block',
}
const hr = { borderColor: '#E5E0D5', margin: '28px 0 20px' }
const footer = { fontSize: '12px', color: '#999999', margin: '24px 0 0', lineHeight: '1.5' }
