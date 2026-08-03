CREATE TABLE public.motivational_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text text NOT NULL,
  author text NOT NULL DEFAULT 'Anônimo',
  category text NOT NULL DEFAULT 'valores',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.motivational_messages TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.motivational_messages TO authenticated;
GRANT ALL ON public.motivational_messages TO service_role;

ALTER TABLE public.motivational_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read active messages"
  ON public.motivational_messages FOR SELECT
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert messages"
  ON public.motivational_messages FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update messages"
  ON public.motivational_messages FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete messages"
  ON public.motivational_messages FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER motivational_messages_set_updated_at
  BEFORE UPDATE ON public.motivational_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.motivational_messages (text, author, category) VALUES
('Deixe o mundo um pouco melhor do que o encontrou.','Baden-Powell','servico'),
('O verdadeiro modo de ser feliz é proporcionar felicidade aos outros.','Baden-Powell','servico'),
('Escoteiro uma vez, escoteiro para sempre.','Baden-Powell','valores'),
('Sorri e assobia em todas as dificuldades.','Baden-Powell','valores'),
('O escotismo é um jogo para os jovens, dirigido pelos jovens.','Baden-Powell','valores'),
('A felicidade não vem da riqueza, mas do trabalho e da satisfação de ver algo bem feito.','Baden-Powell','servico'),
('Sê preparado.','Baden-Powell','valores'),
('A melhor forma de se preparar para a vida é aprender a servir.','Baden-Powell','servico'),
('O caráter é o que faz o homem.','Baden-Powell','valores'),
('Um sorriso vale mais do que mil palavras.','Baden-Powell','amizade'),
('O escoteiro é leal.','Lei Escoteira','lei'),
('O escoteiro é digno de confiança.','Lei Escoteira','lei'),
('O escoteiro está sempre alerta para ajudar o próximo.','Lei Escoteira','lei'),
('O escoteiro é amigo de todos e irmão dos demais escoteiros.','Lei Escoteira','lei'),
('O escoteiro é cortês.','Lei Escoteira','lei'),
('O escoteiro é bom para os animais e as plantas.','Lei Escoteira','lei'),
('O escoteiro é obediente e disciplinado.','Lei Escoteira','lei'),
('O escoteiro é alegre e sorri nas dificuldades.','Lei Escoteira','lei'),
('O escoteiro é econômico e respeita o bem alheio.','Lei Escoteira','lei'),
('O escoteiro é limpo de corpo e alma.','Lei Escoteira','lei'),
('Prometo, pela minha honra, fazer o melhor possível.','Promessa Escoteira','promessa'),
('Cumprir meus deveres para com Deus e minha Pátria.','Promessa Escoteira','promessa'),
('Ajudar o próximo em toda e qualquer ocasião.','Promessa Escoteira','promessa'),
('Obedecer à Lei Escoteira.','Promessa Escoteira','promessa'),
('A liderança é o exemplo vivo de tudo aquilo que se prega.','Baden-Powell','lideranca'),
('Um líder verdadeiro serve antes de ser servido.','Anônimo','lideranca'),
('Grandes líderes inspiram grandeza nos outros.','Anônimo','lideranca'),
('Liderar é abrir caminhos para que outros possam caminhar.','Anônimo','lideranca'),
('Servir é a mais nobre das ações humanas.','Anônimo','servico'),
('Nenhum ato de bondade, por menor que seja, é desperdiçado.','Esopo','servico'),
('Faça algo bom hoje sem esperar recompensa.','Anônimo','servico'),
('A boa ação diária transforma o mundo.','Anônimo','servico'),
('A natureza é o maior livro que já foi escrito.','Anônimo','natureza'),
('Ame a natureza e ela cuidará de você.','Anônimo','natureza'),
('Andar na floresta é conversar com Deus.','Anônimo','natureza'),
('Cada árvore plantada é uma promessa de futuro.','Anônimo','natureza'),
('Respeite a Terra: ela é a casa de todos.','Anônimo','natureza'),
('Amigos são a família que escolhemos.','Anônimo','amizade'),
('A verdadeira amizade se prova nas dificuldades.','Anônimo','amizade'),
('A amizade dobra as alegrias e divide as tristezas.','Francis Bacon','amizade'),
('Sozinhos vamos mais rápido, juntos vamos mais longe.','Provérbio Africano','equipe'),
('O trabalho em equipe faz o sonho funcionar.','John C. Maxwell','equipe'),
('Uma equipe unida vence qualquer desafio.','Anônimo','equipe'),
('Ninguém constrói nada sozinho.','Anônimo','equipe'),
('Ser cidadão é cuidar do outro e do lugar onde se vive.','Anônimo','cidadania'),
('A cidadania começa nos pequenos gestos diários.','Anônimo','cidadania'),
('Um bom cidadão faz um bom país.','Anônimo','cidadania'),
('Educação transforma pessoas; pessoas transformam o mundo.','Paulo Freire','cidadania'),
('Coragem é resistir ao medo, dominá-lo, não é ausência de medo.','Mark Twain','valores'),
('Faça o que é certo, mesmo quando ninguém está olhando.','C. S. Lewis','valores'),
('A honestidade é o primeiro capítulo do livro da sabedoria.','Thomas Jefferson','valores'),
('A disciplina é a ponte entre metas e realizações.','Jim Rohn','valores'),
('Perseverança é o caminho do êxito.','Charles Chaplin','valores'),
('Comece por fazer o necessário, depois o possível, e de repente estará fazendo o impossível.','São Francisco de Assis','valores'),
('A verdadeira aventura começa quando você sai da zona de conforto.','Anônimo','natureza'),
('O acampamento ensina o que nenhuma escola pode.','Anônimo','natureza'),
('Fogueira acesa, coração aquecido.','Anônimo','amizade'),
('O nó bem feito é o começo de uma boa aventura.','Anônimo','valores'),
('A promessa escoteira é um compromisso com a vida.','Anônimo','promessa'),
('Servir sem esperar recompensa é a marca do escoteiro.','Anônimo','servico'),
('Cada dia é uma nova oportunidade de ser útil.','Anônimo','servico'),
('Educar uma criança é iluminar o futuro.','Anônimo','cidadania'),
('O escotismo forma cidadãos do mundo.','Anônimo','cidadania'),
('A verdadeira fraternidade começa na patrulha.','Anônimo','equipe'),
('Confia em quem caminha ao teu lado.','Anônimo','equipe'),
('A alegria é o sol que aquece a caminhada.','Anônimo','valores'),
('Trabalha, canta e sorri.','Baden-Powell','valores'),
('Aprender fazendo é o segredo do escotismo.','Baden-Powell','valores'),
('A vida é uma grande aventura ou nada.','Helen Keller','valores'),
('Onde há vontade, há caminho.','Provérbio','valores'),
('Persistência realiza o impossível.','Provérbio Chinês','valores'),
('A gentileza é uma linguagem que todos entendem.','Madre Teresa','valores'),
('Nunca duvide de que um pequeno grupo de pessoas pode mudar o mundo.','Margaret Mead','equipe'),
('A união faz a força.','Provérbio','equipe'),
('Ser útil aos outros é o melhor uso do tempo.','Anônimo','servico'),
('O sorriso é a primeira boa ação do dia.','Anônimo','amizade'),
('Ame, respeite e proteja a criação.','Anônimo','natureza'),
('Sem trilha, não há caminhada; sem coragem, não há aventura.','Anônimo','natureza'),
('Nunca se esqueça: você é parte da natureza.','Anônimo','natureza'),
('A boa ação de hoje é a lembrança de amanhã.','Anônimo','servico'),
('Servir é reinar.','Anônimo','servico'),
('Um bom líder ouve mais do que fala.','Anônimo','lideranca'),
('Liderar é servir com o exemplo.','Anônimo','lideranca'),
('A humildade é a base da verdadeira liderança.','Anônimo','lideranca'),
('Grandes feitos nascem de pequenas decisões diárias.','Anônimo','valores'),
('A honra é o maior tesouro do escoteiro.','Anônimo','valores'),
('Confiança se conquista com atitudes.','Anônimo','valores'),
('Faça sempre mais do que o esperado.','Anônimo','valores'),
('O mundo precisa de mais boas ações.','Anônimo','servico'),
('Ninguém é tão pequeno que não possa ajudar.','Anônimo','servico'),
('Semeie amizade e colherá irmandade.','Anônimo','amizade'),
('O amanhã pertence a quem se prepara hoje.','Anônimo','valores'),
('Cada estrela é um lembrete de nossos sonhos.','Anônimo','natureza'),
('O respeito é o alicerce da convivência.','Anônimo','valores'),
('Ame a Deus, à Pátria e ao próximo.','Anônimo','promessa'),
('A pátria se constrói com pequenas atitudes cotidianas.','Anônimo','cidadania'),
('O escoteiro cumpre sua palavra.','Anônimo','valores'),
('Fé, honra e dever: pilares da vida escoteira.','Anônimo','valores'),
('Ser preparado é estar pronto para ajudar sempre.','Anônimo','valores'),
('Onde há um escoteiro, há esperança.','Anônimo','valores'),
('A boa ação floresce quando é feita com o coração.','Anônimo','servico'),
('Um dia sem ajudar alguém é um dia perdido.','Anônimo','servico'),
('Compartilhar é o começo da felicidade.','Anônimo','amizade'),
('A caminhada é longa, mas juntos ela é leve.','Anônimo','equipe'),
('Semeie o bem e o bem florescerá em você.','Anônimo','servico');