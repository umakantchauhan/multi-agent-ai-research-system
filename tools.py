from langchain.tools import tool #for the using of the tools like beutiful soap and etc
import requests #webscraping we are sending the request so we are using
from bs4 import BeautifulSoup #webscraping for making the data look cleaner that we are extracting from the internet
from tavily import TavilyClient #to fetch data becasue its going to fetch the data from the internet for research
import os 
from dotenv import load_dotenv
from rich import print # for making the result look good on the terminal
load_dotenv()

tavily = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))

@tool #for converting this to the tool
def web_search(query : str) -> str: #i am going to get the query and send query in the string
    """Search the web for recent and reliable information on a topic . Returns Titles , URLs and snippets."""
    results = tavily.search(query=query,max_results=5) # to not make over the credits so we ask it to only send max 5 results

    out = []

    for r in results['results']:
        out.append(
            f"Title: {r['title']}\nURL: {r['url']}\nSnippet: {r['content'][:300]}\n" #this ine is used to structure the data in the output and 300 word content
        )
    
    return "\n----\n".join(out)

@tool
def scrape_url(url: str) -> str:
    """Scrape and return clean text content from a given URL for deeper reading."""
    try:
        resp = requests.get(url, timeout=8, headers={"User-Agent": "Mozilla/5.0"})#timeout is use to ask if in 8 second no data comes then close it , in header the gent is given name so that when the its taking the data it should feel real user
        soup = BeautifulSoup(resp.text, "html.parser") # resp.text takes the complete raw html of the page
        for tag in soup(["script", "style", "nav", "footer"]):
            tag.decompose()# to remove the thing that are not required
        return soup.get_text(separator=" ", strip=True)[:3000]# seprate them with space and send it in the 3000 words
    except Exception as e:
        return f"Could not scrape URL: {str(e)}"
